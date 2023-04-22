import cors from "cors";
import "dotenv/config";
import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";

type ClientToServerEvents = {
  setName: (username: string) => void;
  updateCanvas: (canvasImage: any) => void;
};

type SetNameResponse = {
  type: "success" | "error";
  message?: string;
};

type ServerToClientEvents = {
  oldCanvas: (canvasImage?: any) => void;
  oldUsers: (users: string[]) => void;
  setName: (res: SetNameResponse) => void;
  updateCanvas: (canvasImage: any) => void;
  join: (username: string) => void;
  leave: (username: string) => void;
};

type SocketData = {
  username: string;
};

const app = express();
const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, {}, SocketData>(server, {
  pingInterval: 100
});

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

const onlineUsers: string[] = [];
let latestCanvasImage: any | undefined;

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "view", "index.html")));
app.get("/draw", (req, res) => res.sendFile(path.join(__dirname, "view", "draw.html")));
app.post("/", (req, res) => {
  const { username } = req.body;

  if (onlineUsers.includes(username)) {
    res.send(`Username '${username}' is already using.`);
  } else {
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