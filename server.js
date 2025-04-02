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
    users.push({ id: socket.id, gender: null });
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

    socket.on('disconnect', () => {
        console.log('A user disconnected');
        users=users.filter(user => user.id!==socket.id);
    });
});

// Start the server
server.listen(PORT, () => {
    console.log(`The server is live at: http://localhost:${PORT}`);
});
