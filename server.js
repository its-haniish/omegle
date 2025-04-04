const express=require('express');
const app=express();
const PORT=8085;
const path=require('path');
const http=require('http');
const { Server }=require('socket.io');

const server=http.createServer(app);
const io=new Server(server);

// In-memory user store
let users=[];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.get('/', (req, res) => {
    res.render('home');
});

// Socket.IO logic
io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.id}`);

    // Add to user list
    users.push({
        id: socket.id,
        gender: null,
        waiting: true,
        partnerId: null,
        offer: null,
    });

    // Receive gender info after face-api.js detection
    socket.on("gender_detected", (data) => {
        const user=users.find(u => u.id===socket.id);
        if (user) {
            user.gender=data.gender;
            console.log(`🧠 Gender updated for ${socket.id}: ${data.gender}`);
        }
    });

    // User ready to chat, sends their offer
    socket.on("join_chat", (data) => {
        const user=users.find(u => u.id===socket.id);
        if (!user||!data?.offer) return;

        // Exit early if already matched
        if (user.partnerId) {
            console.log(`⚠️ ${user.id} already has a partner: ${user.partnerId}`);
            return;
        }

        user.offer=data.offer;

        // Find a suitable partner
        const partner=users.find(u =>
            u.waiting&&
            u.id!==socket.id&&
            u.partnerId===null&&
            u.gender!==null
        );

        if (partner) {
            // Pair users
            user.partnerId=partner.id;
            partner.partnerId=user.id;
            user.waiting=false;
            partner.waiting=false;

            // Exchange offers
            io.to(user.id).emit("match_found", {
                partnerId: partner.id,
                // This one already sent the offer, so no need to send it back
                offer: null,
            });

            io.to(partner.id).emit("match_found", {
                partnerId: user.id,
                offer: user.offer, // send the offer to the partner (responder)
            });


            console.log(`🎯 Matched ${user.id} with ${partner.id}`);
        } else {
            user.waiting=true;
            console.log(`⏳ ${user.id} is waiting for a partner`);
        }
    });


    // Relay ICE candidates
    socket.on("ice_candidate", (data) => {
        const user=users.find(u => u.id===socket.id);
        if (user?.partnerId) {
            io.to(user.partnerId).emit("ice_candidate", data);
        }
    });

    // Relay other signaling data
    socket.on("signal", (data) => {
        const user=users.find(u => u.id===socket.id);
        if (user?.partnerId) {
            io.to(user.partnerId).emit("signal", data);
        }
    });


    // handle msgages
    socket.on("message", (data) => {
        const user=users.find(u => u.id===socket.id);
        if (user?.partnerId) {
            io.to(user.partnerId).emit("message", data);
        }
    });

    socket.on("manualDisconnect", () => {  // ✅ FIXED (consistent event name)
        const user=users.find((u) => u.id===socket.id);
        if (!user) return;

        console.log(`🔌 ${socket.id} finding new chat.`);

        // Notify partner if they exist
        if (user.partnerId) {
            const partner=users.find((u) => u.id===user.partnerId);
            if (partner) {
                partner.partnerId=null;
                partner.waiting=true;
                io.to(partner.id).emit("partner_disconnected");
            }
        }

        // Reset user state
        user.partnerId=null;
        user.waiting=true;
        user.offer=null;
    });


    // 🔄 Handle "Find New Match"
    socket.on("find_new_match", () => {
        const user=users.find((u) => u.id===socket.id);
        if (!user) return;

        console.log(`🔄 ${socket.id} is looking for a new match.`);

        user.waiting=true;
        user.partnerId=null;
        user.offer=null;

        // Try to find a new match immediately
        const partner=users.find(
            (u) => u.waiting&&u.id!==socket.id&&u.partnerId===null&&u.gender!==null
        );

        if (partner) {
            // Pair users
            user.partnerId=partner.id;
            partner.partnerId=user.id;
            user.waiting=false;
            partner.waiting=false;

            // Exchange offers
            io.to(user.id).emit("match_found", { partnerId: partner.id, offer: null });
            io.to(partner.id).emit("match_found", { partnerId: user.id, offer: user.offer });

            console.log(`🎯 Matched ${user.id} with ${partner.id}`);
        } else {
            user.waiting=true;
            console.log(`⏳ ${user.id} is still waiting for a match.`);
        }
    });


    // Handle disconnection
    socket.on("disconnect", () => {
        console.log(`❌ User disconnected: ${socket.id}`);

        const user=users.find(u => u.id===socket.id);

        // If they had a partner, reset their state
        if (user?.partnerId) {
            const partner=users.find(u => u.id===user.partnerId);
            if (partner) {
                partner.partnerId=null;
                partner.waiting=true;
                io.to(partner.id).emit("partner_disconnected");
            }
        }

        // Remove user from list
        users=users.filter(u => u.id!==socket.id);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}`);
});
