import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

import { fileURLToPath } from 'url';
import { dirname } from 'path';

class User {
    ID;
    DisplayName;
    RoomsList;

    ActiveRoomID; // Midlertidig. Kan sikkert gemmes i SessionStorage?

    constructor(id, name) {
        this.ID = id;
        this.DisplayName = name;
        this.RoomsList = [];

        this.ActiveRoomID = -1;
    }
}

class Chatroom {
    ChatID;
    ChatName;
    UserList;
    ActiveUserList;
    MessageList;
    PasswordProtected;
    //Hidden    ; Faktor på DB, ikke så meget her

    constructor(id, name) {
        this.ChatID = id;
        this.ChatName = name;
        this.UserList = [];
        this.ActiveUserList = [];
        this.MessageList = [];
        this.PasswordProtected = false;
    }
}

class ChatMessage {
    UserID;
    UserName; // temp
    Message;
    // Timestamp

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
let chatroomCounter = 3;

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


function Entry() {
    //console.log(process.env.DATABASE_URL);
}


// ========== Client management ==========

io.on("connection", (socket) => {
    //console.log("user connected");

    AssignUser(socket.id);
    socket.emit("SessionStorage", userCounter);
    socket.emit("setuptable", messages);

    ++userCounter;

    socket.on("getDiscovery", () => {
        OnSocketTryGetDiscovery(socket);
    });

    socket.on("getRoomList", () => {
        SendRoomListToSocket(socket);
    });

    socket.on("tryJoinRoom", (roomID) => {
        OnSocketTryJoinChatroom(socket, roomID);
    });

    socket.on("tryEnterRoom", (roomID) => {
        OnSocketTryEnterChatroom(socket, roomID);
    });

    socket.on("tryCreatePublicChatroom", (chatroomName) => {
        OnSocketTryCreatePublicChatroom(socket, chatroomName);
    });

    socket.on("chatMessageRoom", (userID, roomID, message) => {
        OnNewMessageInChatroom(userID, roomID, message);
    });

    socket.on("changeDisplayName", (newName) => {
        ChangeUserDisplayName(socket, newName);
    });

    socket.on("disconnect", () => {
        //console.log("user disconnected");
    });
});


function AssignUser(socketID) {
    const newUser = new User(socketID, "Bruger " + String(userCounter));
    users.push(newUser);
}


// ========== Account ==========

// Ændrer ikke retroaktivt på beskeder. Husk at forbinde bruger id med skærmnavn, og ikke gem navnet i beskeden
// Kan eventuelt cache/gemme en lille lookup tabel, når brugeren deltager i et chatrum, og så spare på noget data der
// Rummet gemmer dog allerede på brugere, men de har ikke navne med
function ChangeUserDisplayName(socket, newName) {
    const uindex = users.findIndex(x => x.ID === socket.id);

    if (uindex !== -1) {
        users[uindex].DisplayName = newName;
    }
}


// ========== Chatroom ==========

function SendRoomListToSocket(socket) {
    //console.log("Sending room list");
    const uindex = users.findIndex(x => x.ID === socket.id);

    if (uindex !== -1) {
        const userRooms = rooms.filter(x => x.UserList.includes(socket.id));

        socket.emit("receiveRoomList", userRooms);
    }
}

function OnSocketTryEnterChatroom(socket, roomID) {
    const uindex = users.findIndex(x => x.ID === socket.id);

    if (uindex !== -1) {
        const user = users[uindex];

        if (Number(user.ActiveRoomID) === Number(roomID)) {
            return;
        }

        const cindex = rooms.findIndex(x => x.ChatID === roomID);

        if (cindex !== -1) {
            const room = rooms[cindex];

            if (room.UserList.includes(socket.id)) {
                if (user.ActiveRoomID !== -1) {
                    socket.leave(String(user.ActiveRoomID));
                    //console.log(socket.id + " left room " + roomID);
                }

                user.ActiveRoomID = roomID;
                socket.join(String(roomID));

                //console.log(socket.id + " joined room " + roomID);

                ServeChatroomToSocket(socket, room);
            }
        }
    }
}

function ServeChatroomToSocket(socket, room) {
    socket.emit("receiveChatroom", room);
}


// ========== Discovery ==========

function OnSocketTryGetDiscovery(socket) {
    SendRoomDiscoveryToSocket(socket);
    //GetChatroomListFromDB(socket);
}

async function GetChatroomListFromDB(socket) {
    const requestOptions = {
        method: "GET",
        redirect: "follow"
    };

    fetch(String(process.env.API_URL) + "/rooms", requestOptions)
        .then((response) => response.text())
        .then((result) => ParseAndSendDiscoveryToSocket(socket, JSON.parse(result)))
        .catch((error) => console.error(error));
}

function ParseAndSendDiscoveryToSocket(socket, chatroomsData) {
    let chatrooms = [];

    for (let i = 0; i < chatroomsData.length; i++) {
        const data = chatroomsData[i];
        
        let newRoom = new Chatroom(data.id, data.name);
        chatrooms.push(newRoom);
    }

    socket.emit("receiveDiscovery", chatrooms);
}


function SendRoomDiscoveryToSocket(socket) {
    // Alle mulige ting
    const uindex = users.findIndex(x => x.ID === socket.id);

    if (uindex !== -1) {
        const discoverableRooms = rooms.filter(x => !x.UserList.includes(socket.id));

        socket.emit("receiveDiscovery", discoverableRooms);
    }
}

function OnSocketTryJoinChatroom(socket, roomID) {
    //console.log("Trying to add user");
    const uindex = users.findIndex(x => x.ID === socket.id);

    if (uindex !== -1) {
        const cindex = rooms.findIndex(x => x.ChatID === roomID);

        if (cindex !== -1) {
            const user = users[uindex];
            const chatroom = rooms[cindex];

            SocketJoinChatroom(socket, user, chatroom);
        }
    }
}

function SocketJoinChatroom(socket, user, chatroom) {
    user.RoomsList.push(chatroom.ChatID);
    chatroom.UserList.push(user.ID);
    
    socket.emit("redirectToRoom", chatroom.ChatID);
}


// ========== Messages ==========

function OnNewMessageInChatroom(userID, roomID, message) {
    const uindex = users.findIndex(u => u.ID === userID);
    const cindex = rooms.findIndex(c => c.ChatID === roomID);

    if (uindex !== -1 && cindex !== -1) {
        const newMessage = new ChatMessage(userID, users[uindex].DisplayName, message);
        rooms[cindex].MessageList.push(newMessage);

        io.to(String(roomID)).emit("newMessageRoom", newMessage);
    }
}


// ========== Creating chatrooms ==========

function OnSocketTryCreatePublicChatroom(socket, chatroomName) {
    const uindex = users.findIndex(u => u.ID === socket.id);

    if (uindex !== -1) {
        const user = users[uindex];

        const newRoom = new Chatroom(chatroomCounter++, String(chatroomName));
        rooms.push(newRoom);

        SocketJoinChatroom(socket, user, newRoom);
    }
}


// ========== MISC ==========

io.engine.on("connection_error", (err) => {
    console.log(err.req);      // the request object
    console.log(err.code);     // the error code, for example 1
    console.log(err.message);  // the error message, for example "Session ID unknown"
    console.log(err.context);  // some additional error context
});

httpServer.listen(port);

Entry();
