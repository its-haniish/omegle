const express=require('express');
const app=express();
const PORT=8085;
const path=require('path');
const http=require('http');
const { Server }=require('socket.io');

const server=http.createServer(app);
const io=new Server(server);
let users=[];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public/')));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.get('/', (req, res) => {
    res.render('home.ejs');
});

// Socket.io
io.on('connection', (socket) => {
    console.log('A user connected');
    users.push({ id: socket.id, gender: null, waiting: true, partnerId: null, offer: null });
    console.log(`Users connected: ${users.length}`);

    socket.on("gender_detected", (data) => {
        console.log("Received detected gender:", data.gender);

        // Update the gender of the user with the matching socket ID
        let user=users.find(user => user.id===socket.id);
        if (user) {
            user.gender=data.gender;
            console.log(`Updated gender for user ${socket.id}: ${data.gender}`);
        }
    });

    socket.on("join_chat", (data) => {
        let user = users.find(user => user.id === socket.id);
        if (user) {
            user.offer = data.offer; // Save the offer from frontend
    
            // Find a waiting user without a partner
            let partner = users.find(u => u.waiting && u.partnerId === null && u.id !== socket.id);
    
            if (partner) {
                // Pair users
                user.partnerId = partner.id;
                partner.partnerId = user.id;
                user.waiting = false;
                partner.waiting = false;
    
                // Send match info and offer to the partner
                io.to(user.id).emit("match_found", { partnerId: partner.id });
                io.to(partner.id).emit("match_found", { partnerId: user.id, offer: user.offer });
    
                console.log(`Matched ${user.id} with ${partner.id}`);
            } else {
                // No partner found, keep waiting
                user.waiting = true;
            }
        }
    });
    

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        let user = users.find(user => user.id === socket.id);
        if (user) {
            let partnerId = user.partnerId;
            if (partnerId) {
                let partner = users.find(u => u.id === partnerId);
                if (partner) {
                    partner.partnerId = null;
                    partner.waiting = true;
                    io.to(partner.id).emit("partner_disconnected");
                }
            }
        }

        users = users.filter(user => user.id !== socket.id);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`The server is live at: http://localhost:${PORT}`);
});
