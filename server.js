const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const db = new Database(path.join(__dirname, 'socialconnect.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
 username TEXT NOT NULL UNIQUE, email TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL, bio TEXT NOT NULL DEFAULT '',
 avatar_color TEXT NOT NULL DEFAULT '#7667f5', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 content TEXT NOT NULL, image_url TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS likes (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(user_id, post_id)
);
CREATE TABLE IF NOT EXISTS comments (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE, content TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);

function demoUser(name, username, email, bio, color) {
 let user = db.prepare('SELECT id FROM users WHERE username=?').get(username);
 if (user) return user.id;
 const result = db.prepare('INSERT INTO users(name,username,email,password_hash,bio,avatar_color) VALUES(?,?,?,?,?,?)')
  .run(name, username, email, bcrypt.hashSync('demo1234', 10), bio, color);
 return Number(result.lastInsertRowid);
}
const demoIds = [
 demoUser('Maya Chen','mayachen','maya@example.com','Collecting little moments ✨','#eaa58b'),
 demoUser('Jordan Lee','jordanlee','jordan@example.com','Design, coffee, and weekend hikes.','#6c91d8'),
 demoUser('Ava Patel','avapatel','ava@example.com','Finding beauty in everyday things.','#b38bd8')
];
if (db.prepare('SELECT COUNT(*) AS n FROM posts').get().n === 0) {
 const add = db.prepare('INSERT INTO posts(user_id,content,image_url) VALUES(?,?,?)');
 add.run(demoIds[0], 'A slow morning, a warm cup of coffee, and absolutely nowhere to be. Sometimes that is the whole plan. ☕', '');
 add.run(demoIds[1], 'Spent the weekend exploring a new trail. A reminder to step away from the screen and look around. 🌿', 'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=1200&q=80');
 add.run(demoIds[2], 'Tiny reminder: you do not have to have everything figured out to take the next step. 💜', '');
}
app.use(express.json({limit:'1mb'}));
app.use(session({name:'socialconnect.sid', secret:process.env.SESSION_SECRET || 'development-secret-change-before-deployment', resave:false, saveUninitialized:false, cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:86400000}}));
app.use(express.static(path.join(__dirname,'public')));
function userFor(req) { return req.session.userId ? db.prepare('SELECT id,name,username,email,bio,avatar_color,created_at FROM users WHERE id=?').get(req.session.userId) || null : null; }
function auth(req,res,next) { if (!userFor(req)) return res.status(401).json({error:'Please sign in to do that.'}); next(); }
function safeUser(u) { return {id:u.id,name:u.name,username:u.username,bio:u.bio,avatar_color:u.avatar_color}; }
function postsFor(viewerId, username) {
 let sql = `SELECT p.id,p.content,p.image_url,p.created_at,u.id user_id,u.name,u.username,u.bio,u.avatar_color,
 (SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) like_count,
 (SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) comment_count
 FROM posts p JOIN users u ON u.id=p.user_id`;
 const args=[]; if(username){sql+=' WHERE u.username=?';args.push(username);} sql+=' ORDER BY p.id DESC LIMIT 50';
 return db.prepare(sql).all(...args).map(p=>({
  id:p.id,content:p.content,image_url:p.image_url,created_at:p.created_at,
  user:{id:p.user_id,name:p.name,username:p.username,bio:p.bio,avatar_color:p.avatar_color},
  like_count:p.like_count,comment_count:p.comment_count,
  liked:viewerId ? Boolean(db.prepare('SELECT 1 FROM likes WHERE user_id=? AND post_id=?').get(viewerId,p.id)) : false,
  comments:db.prepare(`SELECT c.id,c.content,c.created_at,u.id user_id,u.name,u.username,u.avatar_color FROM comments c JOIN users u ON u.id=c.user_id WHERE c.post_id=? ORDER BY c.id ASC LIMIT 20`).all(p.id).map(c=>({id:c.id,content:c.content,created_at:c.created_at,user:{id:c.user_id,name:c.name,username:c.username,avatar_color:c.avatar_color}}))
 }));
}
app.get('/api/me',(req,res)=>res.json({user:userFor(req)}));
app.post('/api/register',(req,res)=>{
 const name=String(req.body.name||'').trim(), username=String(req.body.username||'').trim().toLowerCase().replace(/^@/,''), email=String(req.body.email||'').trim().toLowerCase(), password=String(req.body.password||'');
 if(name.length<2||name.length>50)return res.status(400).json({error:'Name must be between 2 and 50 characters.'});
 if(!/^[a-z0-9_]{3,20}$/.test(username))return res.status(400).json({error:'Username must be 3–20 characters: letters, numbers, or underscores.'});
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Enter a valid email address.'});
 if(password.length<8||password.length>72)return res.status(400).json({error:'Password must be at least 8 characters.'});
 if(db.prepare('SELECT id FROM users WHERE username=? OR email=?').get(username,email))return res.status(409).json({error:'That username or email is already registered.'});
 const colors=['#7667f5','#eaa58b','#6c91d8','#42a995','#b38bd8'];
 const result=db.prepare('INSERT INTO users(name,username,email,password_hash,avatar_color) VALUES(?,?,?,?,?)').run(name,username,email,bcrypt.hashSync(password,10),colors[Math.floor(Math.random()*colors.length)]);
 req.session.userId=Number(result.lastInsertRowid);res.status(201).json({user:safeUser(userFor(req))});
});
app.post('/api/login',(req,res)=>{
 const login=String(req.body.login||'').trim().toLowerCase().replace(/^@/,''), password=String(req.body.password||'');
 const u=db.prepare('SELECT * FROM users WHERE username=? OR email=?').get(login,login);
 if(!u||!bcrypt.compareSync(password,u.password_hash))return res.status(401).json({error:'Those details do not match. Please try again.'});
 req.session.userId=u.id;res.json({user:safeUser(userFor(req))});
});
app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get('/api/posts',(req,res)=>res.json({posts:postsFor(userFor(req)?.id||null)}));
app.post('/api/posts',auth,(req,res)=>{
 const content=String(req.body.content||'').trim(), image=String(req.body.image_url||'').trim();
 if(!content||content.length>1000)return res.status(400).json({error:'Write something (up to 1,000 characters).'});
 if(image&&(!/^https:\/\/\S+$/i.test(image)||image.length>500))return res.status(400).json({error:'Image URL must start with https:// and be under 500 characters.'});
 db.prepare('INSERT INTO posts(user_id,content,image_url) VALUES(?,?,?)').run(req.session.userId,content,image);res.status(201).json({posts:postsFor(req.session.userId)});
});
app.delete('/api/posts/:id',auth,(req,res)=>{
 const id=Number(req.params.id), post=db.prepare('SELECT user_id FROM posts WHERE id=?').get(id);
 if(!post)return res.status(404).json({error:'Post not found.'});if(post.user_id!==req.session.userId)return res.status(403).json({error:'You can only delete your own posts.'});
 db.prepare('DELETE FROM posts WHERE id=?').run(id);res.json({posts:postsFor(req.session.userId)});
});
app.post('/api/posts/:id/like',auth,(req,res)=>{
 const id=Number(req.params.id);if(!db.prepare('SELECT id FROM posts WHERE id=?').get(id))return res.status(404).json({error:'Post not found.'});
 const exists=db.prepare('SELECT 1 FROM likes WHERE user_id=? AND post_id=?').get(req.session.userId,id);
 if(exists)db.prepare('DELETE FROM likes WHERE user_id=? AND post_id=?').run(req.session.userId,id);else db.prepare('INSERT INTO likes(user_id,post_id) VALUES(?,?)').run(req.session.userId,id);
 res.json({posts:postsFor(req.session.userId)});
});
app.post('/api/posts/:id/comments',auth,(req,res)=>{
 const id=Number(req.params.id), content=String(req.body.content||'').trim();if(!db.prepare('SELECT id FROM posts WHERE id=?').get(id))return res.status(404).json({error:'Post not found.'});
 if(!content||content.length>300)return res.status(400).json({error:'Comment must be between 1 and 300 characters.'});
 db.prepare('INSERT INTO comments(user_id,post_id,content) VALUES(?,?,?)').run(req.session.userId,id,content);res.json({posts:postsFor(req.session.userId)});
});
app.get('/api/users/:username',(req,res)=>{
 const username=String(req.params.username||'').toLowerCase();const user=db.prepare(`SELECT u.id,u.name,u.username,u.bio,u.avatar_color,u.created_at,(SELECT COUNT(*) FROM posts p WHERE p.user_id=u.id) post_count FROM users u WHERE u.username=?`).get(username);
 if(!user)return res.status(404).json({error:'Profile not found.'});res.json({user,posts:postsFor(userFor(req)?.id||null,username)});
});
app.patch('/api/profile',auth,(req,res)=>{
 const name=String(req.body.name||'').trim(),bio=String(req.body.bio||'').trim();if(name.length<2||name.length>50)return res.status(400).json({error:'Name must be between 2 and 50 characters.'});if(bio.length>160)return res.status(400).json({error:'Bio must be 160 characters or fewer.'});
 db.prepare('UPDATE users SET name=?,bio=? WHERE id=?').run(name,bio,req.session.userId);res.json({user:safeUser(userFor(req))});
});
app.get('/{*splat}',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`SocialConnect running at http://localhost:${PORT}`));
