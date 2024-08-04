const chatArea = document.getElementById("chat-area");
const chatList = document.getElementById("chat-list");
const userList = document.getElementById("user-list");
const chatInput = document.getElementById("chat-input");

const usernameInput = document.getElementById("username");
const joinButton = document.getElementById("join");
const chatJoinArea = document.getElementById("chat-join-area");
const chatJoinMessage = document.getElementById("chat-join-message");

var ws = null;

var joining = false;
var chat_open = false;
var username = "";

function SendJoin() {
	chatJoinMessage.innerHTML = 'Joining...';
	
	username = usernameInput.value.replaceAll(' ', '_');
	var info = { type: 'join_chat', username: username };
	ws.send(JSON.stringify(info));
}
function SendMessage(message) {
	var info = { type: 'message', message: message };
	ws.send(JSON.stringify(info));
}

function JSONParse() {
	try {
		return JSON.parse(event.data.toString());
	} catch (e) { return null; }
}
function ResetChat() {
	chatList.textContent = '';
	for (var user of userList.children) {
		if (user.tagName === 'P') user.remove();
	}
}

function Connect() {
	ws = new WebSocket('wss://painty-city-server.onrender.com');
	chatJoinMessage.innerText = 'Connecting...\nMay take up to 2 minutes if no one is currently in chat';
	
	ws.addEventListener('open', (event) => {
		chatJoinMessage.innerHTML = 'Connected!';
		SendJoin();
	});
	ws.addEventListener('close', (event) => {
		ws = null;
		joining = false;
		SetInChat(false);
		
		// Failed to connect to server
		if (event.code == 1006) {
			chatJoinMessage.innerHTML = 'Server failed, try again.';
		}
	});
	ws.addEventListener('error', (event) => {
		
	});
	ws.addEventListener('message', function(event) {
		var data = JSONParse(event.data.toString());
		if (!(data instanceof Object)) return;
		
		if (data.type === 'user_join') {
			var p = document.createElement('p');
			p.innerText = data.username;
			userList.appendChild(p);
			
			PutSystemMessage(`<span class="name">${data.username}</span> joined the chat`);
		}
		else if (data.type === 'user_quit') {
			for (var child of userList.children) {
				if (child.innerText == data.username) {
					child.remove();
					break;
				}
			}
			
			PutSystemMessage(`<span class="name">${data.username}</span> left the chat`);
		}
		else if (data.type === 'join_success') {
			joining = false;
			
			SetInChat(true);
			for (var user of data.users) {
				var p = document.createElement('p');
				p.innerText = user;
				userList.appendChild(p);
			}
			var p = document.createElement('p');
			p.innerText = username;
			userList.appendChild(p);
		}
		else if (data.type === 'join_fail') {
			joining = false;
			
			chatJoinMessage.innerHTML = data.reason;
		}
		else if (data.type === 'message') {
			PutMessage(data.author, data.message, data.author === username, new Date(Date.parse(data.time)).toLocaleTimeString());
		}
	});
}

function SetInChat(in_chat) {
	if (in_chat) {
		chat_open = true;
		
		chatArea.classList.remove('hidden');
		chatJoinArea.classList.add('hidden');
	}
	else {
		chat_open = false;
		
		chatArea.classList.add('hidden');
		chatJoinArea.classList.remove('hidden');
		
		ResetChat();
	}
}
function EnterChat() {
	if (usernameInput.value.length >= 3 && usernameInput.value.length <= 16) {
		if (!joining && !chat_open) {
			joining = true;
			
			if (ws === null) Connect();
			else SendJoin();
		}
	}
}

usernameInput.addEventListener('keydown', (event) => {
	if (event.key === 'Enter') EnterChat();
});
joinButton.addEventListener('click', EnterChat);

function CreateTagClass(tag, c) {
	let elem = document.createElement(tag);
	elem.classList.add(c);
	return elem;
}

function PutSystemMessage(content) {
	var chat_block = CreateTagClass('div', 'chat-block');
	var message = CreateTagClass('div', 'system-message');
	var message_content = CreateTagClass('p', 'system-message-content');
	
	message_content.innerHTML = content;
	
	message.appendChild(message_content);
	
	chat_block.appendChild(message);
	
	chatList.appendChild(chat_block);
	
	chatList.scrollTop = chatList.scrollHeight;
}
function PutMessage(author, content, client, time) {	
	var chat_block = CreateTagClass('div', 'chat-block');
	var message = CreateTagClass('div', 'message');
	var message_top = CreateTagClass('div', 'message-top');
	var message_author = CreateTagClass('p', 'message-author');
	var message_time = CreateTagClass('p', 'message-time');
	var message_content = CreateTagClass('p', 'message-content');
	
	if (client) message.classList.add('message-client');
	
	message_author.innerText = author + ' says';
	message_time.innerText = time;
	message_content.innerText = content;
	
	message_top.appendChild(message_author);
	message_top.appendChild(message_time);
	message.appendChild(message_top);
	message.appendChild(message_content);
	
	chat_block.appendChild(message);
	
	chatList.appendChild(chat_block);
	
	chatList.scrollTop = chatList.scrollHeight;
}

chatInput.addEventListener('keydown', (event) => {
	if (event.key === 'Enter' && chatInput.value.length > 0) {
		SendMessage(chatInput.value);
		chatInput.value = '';
	}
});