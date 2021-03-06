
module.exports = function(socket,channels,sockets,sessions,app) {
	debug = true;
	function log(d){
		if(debug)
			console.log(d);
	}
	socket.emit("hello");
    socket.on('disconnect', (reason) => {
        if (socket.Channel) {
			if(socket.User)
				EmitToChannel(socket.Channel,"user left",socket.User.displayName);
			if(channels[socket.Channel].clients[socket.id])
				delete channels[socket.Channel].clients[socket.id];
			if(channels[socket.Channel].peers[socket.peerid])
				delete channels[socket.Channel].peers[socket.peerid];
            log("Cleanup done");
        }
    });
	socket.on("set peer rating",function(peer,rating){
		if(channels[socket.Channel]){
			if(channels[socket.Channel].peers[peer]){
				let temp = channels[socket.Channel].peers[peer]
				temp.Rating = rating;
				channels[socket.Channel].peers[peer] = temp;
			}
		}
	});
	socket.on("mute",(user) => {
		if(socket.IsModerator){
			if(channels[socket.Channel]){
				channels[socket.Channel].muted[user] = true;
				socket.emit("message","System",user + " muted");
			}
		}else{
			socket.emit("message","System","You must be a moderator");
		}
	});
	socket.on("unmute",(user) => {
		if(socket.IsModerator){
			if(channels[socket.Channel]){
				delete channels[socket.Channel].muted[user];
				socket.emit("message","System",user + " unmuted");
			}
		}else{
			socket.emit("message","System","You must be a moderator");
		}
	});
	socket.on("donation",(amt,frm,goal,donated,ctype) => {
		if(socket.IsModerator){
			if(socket.Channel){
				if(channels[socket.Channel]){
					app.model.User.find({xrpaddress: frm},function(err,found){
						if(found){
							if(found[0]){
								frm = found[0].displayName;
							}
						}
						EmitToChannel(socket.Channel,"donation",amt,frm,goal,donated,ctype);
					});
				}
			}
		}
	});
	socket.on("message",(msg) => {
		msg = msg.replace(/<(?:.|\n)*?>/gm, '');
		if (/\S/.test(msg)) {
			if(socket.User){
				if(socket.Channel){
					if(channels[socket.Channel].muted[socket.User.displayName] == true){
						socket.emit("message","System","You are muted");
					}else{
						EmitToChannel(socket.Channel,"message",socket.User.displayName,msg);
					}
				}else{
					socket.emit("message","System","You must join a room to chat");
				}
			}else{
				socket.emit("message","System","Please login to chat.");
			}
		}
	});
	socket.on("set peer max",(peer,max) => {
		if(channels[socket.Channel]){
			if(channels[socket.Channel].peers[peer]){
				channels[socket.Channel].peers[peer].Max = max;

			}
		}
	});
	socket.on("set peer tier",(peer, tier) => {
		if(channels[socket.Channel]){
			if(channels[socket.Channel].peers[peer]){
				channels[socket.Channel].peers[peer].Tier = tier;
			}
		}
	});
	socket.on("get channel clients",function(){
		let count = 0;
		
		if(channels[socket.Channel]){
			for(var i in channels[socket.Channel].peers){
				let peer = channels[socket.Channel].peers[i];
				if(peer.Clients > 1){
					count = count + peer.Clients;
				}
			}
			socket.emit("channel clients",count);
		}
	});
	socket.on("set peer clients",function(peer,clients){
		if(channels[socket.Channel]){
			if(channels[socket.Channel].peers[peer]){
				channels[socket.Channel].peers[peer].Clients = clients;
			}
		}
	});
	socket.on("Call",function(tid,rid){
		log("Making call to " + tid + " from " + rid);
		sockets[rid] = socket;
		if(sockets[tid])
			sockets[tid].emit("Call", rid);
	});
    function EmitToChannel(channel, v1, v2,v3,v4,v5,v6) {
        Object.keys(channels[channel].clients).forEach(function(key) {
            try{
				channels[channel].clients[key].socket.emit(v1, v2,v3,v4,v5,v6);
			}catch(e){
				delete channels[channel].clients[key];
				console.log("Deleted " + key + " from " + channel);
			}
        });
    }
    socket.on("get peer list", function() {
		
		if(socket.Channel){
			if(channels[socket.Channel]){
	socket.emit("peer list", channels[socket.Channel].peers);}}
		
    });
    socket.on("add peer", function(peer) {
		sockets[peer] = socket;
		if(socket.Channel){
			if (!channels[socket.Channel]) {
				channels[socket.Channel] = {
					clients: {},
					peers: {},
					muted: {}
				};
			}
			if(channels[socket.Channel]){
				if(!channels[socket.Channel].peers[peer]){
					socket.peerid = peer;
					channels[socket.Channel].peers[peer] = {Rating: 0, Max: 0, Tier: 0};
					socket.emit("peer list", channels[socket.Channel].peers);
				}else{
					socket.peerid = peer;
					socket.emit("peer list", channels[socket.Channel].peers);	
				}
			}
		}else{
			socket.emit("hello");
		}
    });
	socket.on("get channel users",function(){
		let usrs = {};
		if(channels[socket.Channel]){
			for(var i in channels[socket.Channel].clients){
				let usr = channels[socket.Channel].clients[i];
				if(usr.user){
					if(usr.user.displayName){
						usrs[usr.user.displayName] = true;
						console.log(usr);
						if(usr.socket.IsModerator)
							usrs[usr.user.displayName] = "Moderator";
						
					}
				}
			}
			socket.emit("user list",usrs);
		}
	});
    socket.on("delete peer", function(peer) {
		if (channels[socket.Channel]) {
			if(channels[socket.Channel].peers[peer]){
				delete channels[socket.Channel].peers[peer];
				socket.emit("peer list", channels[socket.Channel].peers);
			}
		}
	});
    socket.on('join channel', function(channel) {
		socket.IsModerator = false;
		if (!channels[channel]) {
			channels[channel] = {
				clients: {},
				peers: {},
				muted: {},
				goal: 0,
				type: 0,
				donated: 0
			};
			socket.IsModerator = true;
		}
		if(socket.User){
			if(socket.User.permissions.admin){
				socket.IsModerator = true;
			}
		}
		socket.Channel = channel;
		if(socket.User){
			app.model.Channel.find({_id: socket.User.channel},function(err,found){
				if(found[0]){
					if(found[0].hash === channel){
						socket.IsModerator = true;
					}
				}
				
				
				if(!channels[channel].clients[socket.id]){
					channels[channel].clients[socket.id] = {
						socket: socket,
						user: socket.User
					};
					if(socket.User)
						EmitToChannel(socket.Channel,"user joined",socket.User.displayName,socket.IsModerator);
					socket.emit("joined channel",channel,socket.IsModerator);
				
				}
			});
		}

		
    });
};