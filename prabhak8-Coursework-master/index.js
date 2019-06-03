#!/usr/bin/env node
/* eslint-disable max-lines */
/* eslint-disable max-statements */
/* eslint-disable max-lines-per-function */

'use strict'

/* MODULE IMPORTS */
const Koa = require('koa')
const Router = require('koa-router')
const views = require('koa-views')
const staticDir = require('koa-static')
const bodyParser = require('koa-bodyparser')
const koaBody = require('koa-body')({multipart: true, uploadDir: '.'})
const session = require('koa-session')
const sqlite = require('sqlite-async')
const bcrypt = require('bcrypt-promise')
const fs = require('fs-extra')
const mime = require('mime-types')
//const jimp = require('jimp')

const app = new Koa()
const router = new Router()

/* CONFIGURING THE MIDDLEWARE */
app.keys = ['darkSecret']
app.use(staticDir('public'))
app.use(bodyParser())
app.use(session(app))


app.use(views(`${__dirname}/views`, { extension: 'handlebars' }, {map: { handlebars: 'handlebars' }}))

const port = 8080
const saltRounds = 10

router.get('/', async ctx => {
	try {
		if(ctx.session.authorised !== true) return ctx.redirect('/login')
		const data = {}
		if(ctx.query.msg) data.msg = ctx.query.msg

		const postImage = []
		const imagePath = `public/${ctx.session.username}`
		fs.readdir(imagePath, (err,files) => {
			if (err) throw err
			files.forEach((image) => {
				console.log(image)
				const fullPath = `${ctx.session.username}/${image}`
				postImage.push(fullPath)
			})
		})
		//data.pathUser = ctx.session.username
		data.imgs = postImage
		console.log(postImage)
		console.log(ctx.session.username)
		return ctx.render('index',data)
	} catch(err) {
		await ctx.render('error', {message: err.message})
	}
})
//x/x/x/x/x/x//x//x/x/x/x/x//x/x//x/x
router.get('/login', async ctx => {
	const data = {}
	if(ctx.query.msg) data.msg = ctx.query.msg
	if(ctx.query.user) data.user = ctx.query.user
	await ctx.render('login', data)
})

router.post('/login', async ctx => {
	try {
		const body = ctx.request.body
		const db = await sqlite.open('./website.db')
		// DOES THE USERNAME EXIST?
		const records = await db.get(`SELECT count(id) AS count FROM users WHERE user="${body.user}";`)
		if(!records.count) return ctx.redirect('/login?msg=invalid%20username')
		const record = await db.get(`SELECT pass FROM users WHERE user = "${body.user}";`)
		await db.close()
		// DOES THE PASSWORD MATCH?
		const valid = await bcrypt.compare(body.pass, record.pass)
		if(valid === false) return ctx.redirect(`/login?user=${body.user}&msg=invalid%20password`)
		// WE HAVE A VALID USERNAME AND PASSWORD
		ctx.session.authorised = true
		ctx.session.username = ctx.request.body.user
		console.log(ctx.session.username)
		return ctx.redirect('/?msg=you are now logged in...')
	} catch(err) {
		await ctx.render('error', {message: err.message})
	}
})
//x/x/x/x/x/x//x//x/x/x/x/x//x/x//x/x
router.get('/register', async ctx => {
	const data = {}
	if(ctx.query.msg) data.msg = ctx.query.msg
	if(ctx.query.user) data.user = ctx.query.user
	data.countries = JSON.parse(fs.readFileSync('countries.json'))
	await ctx.render('register', data)
})


router.post('/register', koaBody, async ctx => {
	let body = ctx.request.body
	try {
		if (body.user === '' && body.pass === '') return ctx.redirect('/register?msg=no%20username/password')
		if (body.user === '' || body.pass === '') return ctx.redirect('/register?msg=no%20username%password')
		body = ctx.request.body
		let db = await sqlite.open('./website.db')
		const records = await db.get(`SELECT count(id) AS count FROM users WHERE user="${body.user}";`)
		if(records.count) return ctx.redirect('/login?msg=invalid%20username')
		await db.close()
		body = ctx.request.body
		console.log(body)
		// PROCESSING FILE
		const {path, type} = ctx.request.files.avatar
		const fileExtension = mime.extension(type)
		const username = ctx.request.body.user
		console.log(`path: ${path}`)
		console.log(`type: ${type}`)
		console.log(`fileExtension: ${fileExtension}`)
		await fs.copy(path, `public/avatars/${username}.${fileExtension}`)
		// ENCRYPTING PASSWORD AND BUILDING SQL
		body.pass = await bcrypt.hash(body.pass, saltRounds)
		const sql = `INSERT INTO users(user, rlName, pass, countries) VALUES("${body.user}","${body.rlName}",         "${body.pass}", "${body.countries}")`
		console.log(sql)
		fs.mkdirSync(`public/${username}`) // removed ;
		// DATABASE COMMANDS
		db = await sqlite.open('./website.db')
		await db.run(sql)
		await db.close()
		// REDIRECTING USERTO HOME PAGE
		ctx.session.authorised = true
		ctx.session.username = ctx.request.body.user
		ctx.redirect(`/login?msg=new user "${body.name}" added`)
	} catch(err) {
		await ctx.render('error', {message: err.message})
	}
})
//x/x/x/x/x/x//x//x/x/x/x/x//x/x//x/x
router.get('/profile', async ctx => {
	try {
		const data = {}
		if (ctx.query.msg) data.msg = ctx.query.msg
		if (ctx.query.user) data.user = ctx.query.user
		const profilePic = ctx.session.username
		const db = await sqlite.open('./website.db')
		const records = await db.get(`select user, rlName, countries from users where user="${profilePic}"`)
		data.sql = `SELECT * FROM users where user = "${profilePic}";`
		data.getProfile = await db.get(data.sql)
		await db.close()
		const imagePath = fs.readdirSync('./public/avatars').filter(fn => fn.startsWith(records.user))
		if (imagePath.length > 0) {
			data.file = `avatars/${imagePath[0]}`
		}
		console.log(data)
		return ctx.render('profile', data)
	} catch (err) {
		await ctx.render('error', {
			message: err.message
		})
	}
})
//x/x/x/x/x/x//x//x/x/x/x/x//x/x//x/x
router.get('/addPhotos', async ctx => {
	try {
		const data = {}
		return ctx.render('addPhotos', data)
		 } catch (err) {
		await ctx.render('error', {
			message: err.message
		})
	}
})

router.post('/addPhotos', koaBody, async ctx => {
	try{
		const start = Date.now()
		console.log(ctx.session.username)
		const {path,size,type} = ctx.request.files.image
	    const fileExtension = mime.extension(type)
	     if(size !== 0) await fs.copy(path, `public/${ctx.session.username}/${start}.${fileExtension}`)
		ctx.redirect('/')
	}catch (err) {
    	 await ctx.render('error', {
			 message: err.message
		 })
	}
})
//x/x/x/x/x/x//x//x/x/x/x/x//x/x//x/x
router.get('/market', async ctx => {
	const data = {}
	if(ctx.query.msg) data.msg = ctx.query.msg
	if(ctx.query.user) data.user = ctx.query.user
	await ctx.render('market', data)
})
//x/x/x/x/x/x//x//x/x/x/x/x//x/x//x/x
router.get('/buy', async ctx => {
	const data = {}
	if(ctx.query.msg) data.msg = ctx.query.msg
	if(ctx.query.user) data.user = ctx.query.user
	await ctx.render('buy', data)
})
//x/x/x/x/x/x//x//x/x/x/x/x//x/x//x/x
router.get('/logout', async ctx => {
	ctx.session.authorised = null
	ctx.redirect('/')
})
//x/x/x/x/x/x//x//x/x/x/x/x//x/x//x/x
app.use(router.routes())
module.exports = app.listen(port, async() => {
// MAKE SURE WE HAVE A DATABASE WITH THE CORRECT SCHEMA
	const db = await sqlite.open('./website.db')
	await db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, pass TEXT);')
	await db.close()
	console.log(`listening on port ${port}`)
})
