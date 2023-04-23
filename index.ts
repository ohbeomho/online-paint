import cors from "cors";
import "dotenv/config";
import express from "express";
import http from "http";
import path from "path";
import { Server } from "socket.io";

type ClientToServerEvents = {
  setName: (username: string) => void;
  updateCanvas: (canvasImage: string) => void;
  draw: (data: any) => void;
  chat: (message: string) => void;
};

type SetNameResponse = {
  type: "success" | "error";
  message?: string;
};

type ServerToClientEvents = {
  oldCanvas: (canvasImage?: string) => void;
  oldUsers: (users: string[]) => void;
  setName: (res: SetNameResponse) => void;
  updateCanvas: (canvasImage: any) => void;
  join: (username: string) => void;
  leave: (username: string) => void;
  draw: (data: any, username: string) => void;
  chat: (message: string, username: string) => void;
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
let latestCanvasImage: string | undefined;

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

  socket.on("updateCanvas", (canvasImage) => (latestCanvasImage = canvasImage));
  socket.on(
    "draw",
    (data) => socket.data.username && socket.broadcast.emit("draw", data, socket.data.username)
  );
  socket.on(
    "chat",
    (message) =>
      socket.data.username && socket.broadcast.emit("chat", message, socket.data.username)
  );
  socket.on("disconnect", () => {
    if (!socket.data.username) {
      return;
    }

    onlineUsers.splice(onlineUsers.indexOf(socket.data.username), 1);

    if (onlineUsers.length === 0) {
      latestCanvasImage = undefined;
    }

    socket.broadcast.emit("leave", socket.data.username);
  });
});

server.listen(Number(process.env.PORT), () => console.log("Server is online."));
