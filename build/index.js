"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const cors_1 = __importDefault(require("cors"));
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const path_1 = __importDefault(require("path"));
const socket_io_1 = require("socket.io");
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    pingInterval: 100
});
app.use(express_1.default.static(path_1.default.join(__dirname, "public")));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: false }));
app.use((0, cors_1.default)());
const onlineUsers = [];
let latestCanvasImage;
app.get("/", (req, res) => res.sendFile(path_1.default.join(__dirname, "view", "index.html")));
app.get("/draw", (req, res) => res.sendFile(path_1.default.join(__dirname, "view", "draw.html")));
app.post("/", (req, res) => {
    const { username } = req.body;
    if (onlineUsers.includes(username)) {
        res.send(`Username '${username}' is already using.`);
    }
    else {
        res.redirect(`/draw?username=${username}`);
    }
});
io.on("connection", (socket) => {
    socket.once("setName", (username) => {
        socket.emit("oldUsers", onlineUsers);
        socket.emit("oldCanvas", latestCanvasImage);
        socket.data.username = username;
        onlineUsers.push(username);
        socket.broadcast.emit("join", username);
    });
    socket.on("updateCanvas", (canvasImage) => {
        socket.broadcast.emit("updateCanvas", canvasImage);
        latestCanvasImage = canvasImage;
    });
    socket.on("disconnect", () => {
        onlineUsers.splice(onlineUsers.indexOf(String(socket.data.username)), 1);
        if (onlineUsers.length === 0) {
            latestCanvasImage = undefined;
        }
        socket.broadcast.emit("leave", String(socket.data.username));
    });
});
server.listen(Number(process.env.PORT), () => console.log("Server is online."));
