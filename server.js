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

    socket.on("gender_detected", (data) => {
        let user=users.find(u => u.id===socket.id);
        if (user) {
            user.gender=data.gender;
            console.log(`Updated gender for ${socket.id}: ${data.gender}`);
        }
    });

    socket.on("join_chat", (data) => {
        if (!data) {
            console.error("Error: Received invalid offer.");
            return;
        }

        let user=users.find(u => u.id===socket.id);
        if (user) {
            user.offer=data.offer;

            let partner=users.find(u => u.waiting&&u.partnerId===null&&u.id!==socket.id&&u.gender!==null);
            if (partner) {
                user.partnerId=partner.id;
                partner.partnerId=user.id;
                user.waiting=false;
                partner.waiting=false;

                io.to(user.id).emit("match_found", { partnerId: partner.id, offer: partner.offer });
                io.to(partner.id).emit("match_found", { partnerId: user.id, offer: user.offer });

                console.log(`Matched ${user.id} with ${partner.id}`);
            } else {
                user.waiting=true;
            }
        }
    });

    socket.on("ice_candidate", (data) => {
        let user=users.find(u => u.id===socket.id);
        if (user&&user.partnerId) {
            io.to(user.partnerId).emit("ice_candidate", data);
        }
    });

    socket.on("signal", (data) => {

        let user=users.find(u => u.id===socket.id);
        if (user&&user.partnerId) {
            io.to(user.partnerId).emit("signal", data);
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        let user=users.find(u => u.id===socket.id);
        if (user) {
            let partner=users.find(u => u.id===user.partnerId);
            if (partner) {
                partner.partnerId=null;
                partner.waiting=true;
                io.to(partner.id).emit("partner_disconnected");
            }
        }
        users=users.filter(u => u.id!==socket.id);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server running at: http://localhost:${PORT}`);
});
