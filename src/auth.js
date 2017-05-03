let redis = require('redis').createClient('redis://h:pcf92368c93ed15c76365184f1c92ce28fc17cb58d2bc43b3afd6d6a4d1ec6d31@ec2-34-206-56-13.compute-1.amazonaws.com:48599')
let Profile=require('./model.js').Profile
let User=require('./model.js').User
let Article=require('./model.js').Article
let Comment=require('./model.js').Comment
const md5=require('md5')
let myUser = {users: []}
let sessionUser=[]
let cookieKey = 'sid'
let session_id=0

let users=[]
var request=require('request')
var qs=require('querystring')
var express=require('express')
var cookieParser=require('cookie-parser')
var session=require('express-session')
var passport=require('passport')
const bodyParser = require('body-parser')
var FacebookStrategy=require('passport-facebook').Strategy

const config={
	clientID: '814687735350697',
	clientSecret: 'ed2bb8161a64f64b09086ea12df99c49',
	callbackURL: 'https://wanyibookfinal.herokuapp.com/auth/callback'
}

passport.use(new FacebookStrategy(config,
	function(token,refreshToken,profile,done){//save user and profile of the facebook account
		User.findOne({username: profile.displayName}).exec(function(err, users) {
			if(!users || users.length == 0){
				new User({username: profile.displayName, fb_id: profile.id}).save(function (err, users){
					if(err) 
					{
						console.log(err)
					}
					else{
						new Profile({ username: profile.displayName, 
							email: "fbemail@fb.com", 
							phone: "111-111-1111", 
							dob: new Date(), 
							zipcode: "99999", 
							headline: 'Your default headline', 
							avatar: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Official_portrait_of_Barack_Obama.jpg', 
							following: [] }).save(function (err, users){
							if(err) {
								console.log(err)
							}
						})
					}
				})
			}
		})
		return done(null, profile)
	})
)

passport.serializeUser(function(user, done) {
	done(null, user.id)
})
passport.deserializeUser(function(id, done) {
	User.findOne({fb_id: id}).exec(function(err, user) {
		done(null, user)
	})
})


function profile(req, res) {//reload frontend
	res.redirect(req.headers.referer)
}

function fail(req,res){
	res.send('Failed')
}

function logOut(req, res) {
	if (req.isAuthenticated()) {//facebook login
		req.session.destroy()
		req.logout()
		res.status(200).send("OK")
	} else {//regular login
		const sid=req.cookies[cookieKey]
		if(sid){
			redis.del(sid)
			res.clearCookie(cookieKey)
			res.status(200).send('OK')
		}else{
			res.status(401).send('you have not logged in')
		}
	}
}

function fblink(req, res){//link fb account with a regular account
	 let normalname
	 //get regular username
	if(!req.body.normalname||!req.body.password){
		if(req.normalname)
			{normalname=req.normalname}
		else
			{res.status(401).send('you have not logged in with two account')}
	}
	normalname=req.body.normalname
	User.find({ username : normalname }).exec(function(err, users){
		if (err) {
			res.status(401).send('No such user')
		} else {
			if(users&&users[0]&&isAuthorized(req, users[0]||req.normalname)){
				const updatename=normalname
				const username=req.user.username
				//update article author
				Article.update({author:username}, {$set: {'author': updatename}}, { new: true, multi: true }).exec( function(err, arts){
					if(err){
						console.log(err)
					}else{
						//update comments in articles
						Article.update({'comments.author' : username}, { $set: {'comments.$.author': updatename}}, { new: true, multi: true }).exec( function(err, arts){
							if(err){
								console.log(err)
							}
							else{
								//update comment
								Comment.update({author:username}, {$set: {'author': updatename}}, { new: true, multi: true }).exec(function(err, comms){
									if(err){
										console.log(err)
									}else{
										//update profile followers
										Profile.findOne({username: username}).exec(function(err, profile){
											if(profile){
												Profile.findOne({username: updatename}).exec(function(err, updateProfile) {
													if(updateProfile){
														const newFollowers = updateProfile.following.concat(profile.following)
														Profile.update({username: updatename}, {$set: {'following': newFollowers}}, function(err, pros){
															if(err){
																console.log(err)
															}else{
																//add auth to the regular user
																User.findOne({username: updatename}).exec(function(err, user){
																	if(user){
																		const auth = {}
																		auth['facebook'] = username//add facebook user to auth
																		User.update({username: updatename}, {$addToSet: {'auth': auth}}, {new: true}, function(err, user){
																			if(err){
																				console.log(err)
																			}else{
																				res.status(200).send({ username: updatename, result: 'link success'})
																			}
																		})
																	}
																})
															}
														})
													}
												})
											}
										})
									}
								})
							}
						})
					}
				})
			}
		}
	})
}

function fbunlink(req, res){// unlink
	//clear the auth in regular user
	User.update({username: req.username}, {$set: {auth: []}}, {new: true}).exec( function(err, user){
		if(err)
		{
			res.status(401).send('failed to unlink the account')
		}else{
			res.send({username:req.username, result:'unlink success'})
		}
	})	
}

const index = (req, res) => {
	res.send({ hello: 'world' })
}
function login(req,res){//login
	let username = req.body.username
	let password = req.body.password
	if(!username || !password){
		res.sendStatus(400)
		return
	}
	getUser(username, function(err, userObj) {//get user
		if (err) {
		} else {
			if(!userObj ||!isAuthorized(req, userObj)){
				res.sendStatus(401)
				return
			}
			const sid=md5(username)
			redis.hmset(sid, {username})
			res.cookie(cookieKey, sid,{maxAge: 3600*1000,//set cookie
			httpOnly: true})
			let msg={username: username, result:'success'}
			res.send(msg)
		}
	})
}

function isAuthorized(req, auth){
	return auth.hash === md5(auth.salt + req.body.password)
}
//check if logged in, otherwise return default user 'wl49test'
function isLoggedIn(req, res, next){
	if(req.isAuthenticated()){
		const authObj = {}
		authObj['facebook'] = req.user.username
		User.findOne({auth: authObj}).exec(function(err, user) {
			if(!user){
				req.username = req.user.username
			} else {
				req.username = user.username
			}
			next()
		})
	}else{
		let sid=req.cookies[cookieKey]
		if(!sid){
			next()
			return
		}
		else{
			redis.hgetall(sid, function(err, userObj){
				if(userObj){
					req.username=userObj.username
					req.normalname=userObj.username
					next()
				}else{
					res.status(401).send('this user does not exist')
				}
			})
		}
	}
}
function logout(req,res){//logout
	const sid=req.cookies[cookieKey]
	if(sid){
		redis.del(sid)
		res.clearCookie(cookieKey)
		res.status(200).send('OK')
	}else{
		res.status(401).send('you have not logged in')
	}
}

function register(req, res){// register
	let username=req.body.username
	let password=req.body.password
	if(!username||!password||!req.body.email||!req.body.dob||!req.body.zipcode){
		res.sendStatus(400)
		return
	}
	let salt = ""
	let generateSaltString = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	for(let i=0; i < 5; i++ ){
		salt =salt+generateSaltString.charAt(Math.floor(Math.random()*generateSaltString.length))
	}

	let hash = md5(salt + password)
	new User({username: username, salt: salt, hash: hash }).save(function(){
		new Profile({ username: username, email: req.body.email, phone: req.body.phone||'713-560-0000', dob: req.body.dob, zipcode: req.body.zipcode, headline: 'Your default headline', 
		avatar: 'https://upload.wikimedia.org/wikipedia/commons/e/e9/Official_portrait_of_Barack_Obama.jpg', following: [] }).save(function(){
			res.send({username: username, result: 'success'})
		})
	})
}
function getUser(username, callback){
	User.find({ username : username }).exec(function(err, users){
		if (err) {
			callback(err, null)
		} else {
			callback(null, users[0])
		}
	})
}
//change password and create new salt
function putPassword(req, res){
	if(!req.username){
		res.status(401).send('You have not logged in')
		return
	}
	if(!req.body.password){
		res.status(400).send('There is no password')
		return
	}
	let salt = ""
	let generateSaltString = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	for(let i=0; i < 5; i++ ){
		salt =salt+generateSaltString.charAt(Math.floor(Math.random()*generateSaltString.length))
	}
	let hash = md5(salt + req.body.password)
	User.update({username: req.username}, {salt: salt, hash: hash}).exec(function(err, users) {
		if (err) {
			res.status(401).send('Failed to change password')
		} else {
			res.send({
				username: req.username,
				password: req.body.password
			})
		}
	})
}
//get the type of login, fb or regular
function loggintype(req, res){
	User.findOne({username: req.username}).exec(function(err, user) {
		if(err){
			res.status(401).send('You have not logged in')
		}else{
			if(user.fb_id){
				res.send({fb_loggin:true})
			}else{
				res.send({fb_loggin:false})
			}
		}
	})
}

module.exports ={
	app:(app) => {
		app.use(session({secret:'thissMySecretMessageHowWillYouGuessIt'}))
		app.use(passport.initialize())
		app.use(passport.session())
		app.use(cookieParser())
		app.use('/auth/facebook', passport.authenticate('facebook',{scope:'email'}))
		app.use('/auth/callback',passport.authenticate('facebook',{
			 	successRedirect:'/profile',failureRedirect:'/fail'
			 }))
		app.use('/profile',isLoggedIn, profile)
		app.use('/fail',fail)
		app.get('/',index)
		app.put('/logout', isLoggedIn, logOut)
		app.post('/login', login)
		app.put('/password', isLoggedIn, putPassword)
		app.post('/register', register)
		app.post('/fblink', isLoggedIn, fblink)
		app.get('/fbunlink', isLoggedIn, fbunlink)
		app.get('/loggintype',isLoggedIn, loggintype)
	},
	isLoggedIn,
	getUser
}
	
