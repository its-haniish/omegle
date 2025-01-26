const express = require('express');
const app = express();
const PORT = 8085;
const path = require('path');
const socket = require('socket.io');
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public/')));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Routes
app.get('/', (req, res) => {
    res.render('home.ejs');
});



// Start the server
app.listen(PORT, () => {
    console.log(`The server is live at: http://localhost:${PORT}`);
});
 