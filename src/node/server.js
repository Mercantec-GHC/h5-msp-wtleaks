import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

import { fileURLToPath } from 'url';
import { dirname } from 'path';

class User {
    ID;
    DisplayName;
    RoomsList;

    constructor(id, name) {
        this.ID = id;
        this.DisplayName = name;
        this.RoomsList = [];
    }
}

class Chatroom {
    ChatID;
    ChatName;
    UserList;
    ActiveUserList;
    MessageList;

    constructor(id, name) {
        this.ChatID = id;
        this.ChatName = name;
        this.UserList = [];
        this.ActiveUserList = [];
        this.MessageList = [];
    }
}

class ChatMessage {
    UserID;
    UserName; // temp
    Message;

    constructor(id, name, message) {
        this.UserID = id;
        this.UserName = name;
        this.Message = message;
    }
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const hostname = "127.0.0.1";
const port = 3000;


const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {origin: "*" },
});


let rooms = [
    { ChatID: 0, ChatName: "Generel", UserList: [], ActiveUserList: [], MessageList: [] },
    { ChatID: 1, ChatName: "Nørderi", UserList: [], ActiveUserList: [], MessageList: [] },
    { ChatID: 2, ChatName: "Uartige ting", UserList: [], ActiveUserList: [], MessageList: [] },
]

let userCounter = 0;

let users = [];
let messages = [];


app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

app.get("/client.js", (req, res) => {
    res.sendFile(__dirname + "/client.js");
});

app.get("/style.css", (req, res) => {
    res.sendFile(__dirname + "/style.css");
});


io.on("connection", (socket) => {
    //console.log("user connected");

    AssignUser(socket.id);
    socket.emit("SessionStorage", userCounter);
    socket.emit("setuptable", messages);

    ++userCounter;

    socket.on("getRooms", () => {
        SendRoomDiscoveryToSocket(socket);
    });

    socket.on("getRoomList", () => {
        SendRoomListToSocket(socket);
    });

    socket.on("tryJoinRoom", (roomID) => {
        TryJoinRoom(socket, roomID);
    });

    socket.on("enterRoom", (roomID) => {
        EnterRoom(socket, roomID);
    });

    socket.on("chatmessage", (id, name, message) => {
        //console.log("incoming message");
        ReceiveMessage(id, name, message);
    });

    socket.on("changeDisplayName", (newName) => {
        ChangeUserDisplayName(socket, newName);
    });

    socket.on("disconnect", () => {
        //console.log("user disconnected");
    });
});

function AssignUser(socketID) {
    let newUser = new User(socketID, "Bruger " + String(userCounter));
    users.push(newUser);
}

function SendRoomDiscoveryToSocket(socket) {
    // Alle mulige ting
    let uindex = users.findIndex(x => x.ID === socket.id);

    if (uindex !== -1) {
        let discoverableRooms = rooms.filter(x => !x.UserList.includes(socket.id));

        socket.emit("receiveRooms", discoverableRooms);
    }
}

function ReceiveMessage(id, name, message) {
    /*
    let index = users.findIndex(x => x.ID === id);

    if (index !== -1) {
        //console.log(String(id) + " " + String(message));

        let newMessage = new ChatMessage(users[index].ID, users[index].DisplayName, message);
        //console.log(String(newMessage.UserName) + " " + String(newMessage.Message));
        messages.push(newMessage);

        io.emit("newmessage", newMessage);
    }
    */

    let newMessage = new ChatMessage(id, name, message);
    messages.push(newMessage);
    io.emit("newmessage", newMessage);
}

function TryJoinRoom(socket, roomID) {
    //console.log("Trying to add user");
    let uindex = users.findIndex(x => x.ID === socket.id);

    if (uindex !== -1) {
        let cindex = rooms.findIndex(x => x.ChatID === roomID);

        if (cindex !== -1) {
            users[uindex].RoomsList.push(roomID);
            rooms[cindex].UserList.push(socket.id);

            console.log("User added to room");

            socket.emit("redirectToRoom", roomID);
        }
    }
}

function SendRoomListToSocket(socket) {
    //console.log("Sending room list");
    let uindex = users.findIndex(x => x.ID === socket.id);

    if (uindex !== -1) {
        let userRooms = rooms.filter(x => x.UserList.includes(socket.id));

        socket.emit("receiveRoomList", userRooms);
    }
}

function JoinRoom(socket, roomID) {
    let cindex = rooms.findIndex(x => x.ChatID === roomID);

    if (cindex !== -1) {
        const room = rooms[cindex];

        if (room.UserList.includes(socket.id)) {

        }
    }
}

function EnterRoom(socket, roomID) {
    
}

function ChangeUserDisplayName(socket, newName) {
    let uindex = users.findIndex(x => x.ID === socket.id);

    if (uindex !== -1) {
        users[uindex].DisplayName = newName;
    }
}

io.engine.on("connection_error", (err) => {
  console.log(err.req);      // the request object
  console.log(err.code);     // the error code, for example 1
  console.log(err.message);  // the error message, for example "Session ID unknown"
  console.log(err.context);  // some additional error context
});

httpServer.listen(port);
