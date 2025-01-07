require('dotenv').config()
const express = require('express')
const jwt = require('jsonwebtoken')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT =  3001
app.use(express.json())  
const usersPath = path.join(__dirname, 'data', 'users.json')
const logsPath = path.join(__dirname, 'data', 'logs.json')
const postsPath = path.join(__dirname, 'data', 'posts.json')


app.post('/users/register', (req, res) => {
  const { username, email, password, bio } = req.body
  const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'))
  if (users[username]) {
    return res.status(400).json({ message: 'This user already exists.' })
  }

  if (Object.values(users).find(user => user.email === email)) {
    return res.status(400).json({ message: 'This email is already registered.' })
  }
  users[username] = { username, email, password, bio }
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2))

  const logs = JSON.parse(fs.readFileSync(logsPath, 'utf-8'))
  logs.push({ event: 'User Registered', username, timestamp: new Date() })
  fs.writeFileSync(logsPath, JSON.stringify(logs, null, 2))

  res.status(201).json({ message: 'User successfully registered' })
})


app.post('/users/login', (req, res) => {
    const { username, password } = req.body

    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'))
  
    const user = users[username]
    if (!user) {
      return res.status(401).json({ message: 'Incorrect username or password.' })
    }
    if (user.password !== password) {
      return res.status(401).json({ message: 'Incorrect username or password.' })
    }

    const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' })
    res.status(200).json({ message: 'Login successful.', token })
  })


app.post('/posts', (req, res) => {
    const { title, content, author } = req.body
  
    const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'))
  
    const newPost = {
      id: posts.length + 1,
      title,
      content,
      timestamp: new Date(),
      author
    }
  
    posts.push(newPost)
    fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2))
  
    res.status(201).json({ message: 'Post created successfully.', post: newPost })
  })


app.get('/posts', (req, res) => {
    const { author, keyword } = req.query
  
    const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'))
    let filteredPosts = posts

    if (author) {
      filteredPosts = filteredPosts.filter(post => post.author === author)
    }
    if (keyword) {
      filteredPosts = filteredPosts.filter(post => post.title.includes(keyword) || post.content.includes(keyword))
    }
  
    res.status(200).json(filteredPosts)
  })


const authenticateJWT = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1]  
  
    if (!token) return res.status(403).json({ message: 'You do not have access.' })
  
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
      if (err) return res.status(403).json({ message: 'Invalid token' })
  
      req.user = user
      next()
    })
  }
  

app.put('/posts/:id', authenticateJWT, (req, res) => {
    const { id } = req.params
    const { title, content } = req.body
  
    const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'))
  
    const post = posts.find(p => p.id === parseInt(id))
    if (!post) return res.status(404).json({ message: 'Not found post ' })
  
    if (post.author !== req.user.username) {
      return res.status(403).json({ message: 'You cannot edit this post.' })
    }
  
    post.title = title || post.title
    post.content = content || post.content
  
    fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2))
    res.status(200).json({ message: 'Post successfully edited.', post })
  })


app.delete('/posts/:id', authenticateJWT, (req, res) => {
    const { id } = req.params
    const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'))
  
    const postIndex = posts.findIndex(p => p.id === parseInt(id))
    if (postIndex === -1) return res.status(404).json({ message: 'Not found' })
  
    if (posts[postIndex].author !== req.user.username) {
      return res.status(403).json({ message: 'You can not delete this post' })
    }
  
    posts.splice(postIndex, 1)
    fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2))
  
    res.status(200).json({ message: 'Post successfully deleted.' })
  })


app.post('/posts/:id/like', authenticateJWT, (req, res) => {
    const { id } = req.params
    const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'))
  
    const post = posts.find(p => p.id === parseInt(id))
    if (!post) return res.status(404).json({ message: 'Not found' })
  
    if (post.likes && post.likes.includes(req.user.username)) {
      return res.status(400).json({ message: 'You already liked this post.' })
    }
  
    post.likes = post.likes || []
    post.likes.push(req.user.username)
  
    fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2))
    res.status(200).json({ message: 'Post successfully liked.' })
  })


app.post('/posts/:id/comment', authenticateJWT, (req, res) => {
    const { id } = req.params
    const { content } = req.body
  
    const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'))
  
    const post = posts.find(p => p.id === parseInt(id))
    if (!post) return res.status(404).json({ message: 'Not found' })
  
    const newComment = {
      author: req.user.username,
      content,
      timestamp: new Date()
    }
  
    post.comments = post.comments || []
    post.comments.push(newComment)
  
    fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2))
    res.status(201).json({ message: 'Successfully commented' })
  })


app.get('/posts/:id/comments', (req, res) => {
    const { id } = req.params
    const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'))
  
    const post = posts.find(p => p.id === parseInt(id))
    if (!post) return res.status(404).json({ message: 'Post not found' })
  
    res.status(200).json(post.comments || [])
  })


app.get('/search/users', (req, res) => {
    const { username, bio } = req.query
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'))
  
    let filteredUsers = Object.values(users)
  
    if (username) {
      filteredUsers = filteredUsers.filter(user => user.username.includes(username))
    }
    if (bio) {
      filteredUsers = filteredUsers.filter(user => user.bio && user.bio.includes(bio))
    }
  
    res.status(200).json(filteredUsers)
  })


app.get('/search/posts', (req, res) => {
    const { title, content } = req.query
    const posts = JSON.parse(fs.readFileSync(postsPath, 'utf-8'))
  
    let filteredPosts = posts
  
    if (title) {
      filteredPosts = filteredPosts.filter(post => post.title.includes(title))
    }
    if (content) {
      filteredPosts = filteredPosts.filter(post => post.content.includes(content))
    }
  
    res.status(200).json(filteredPosts)
  })


const logRequest = (req, res, next) => {
    const log = {
      method: req.method,
      url: req.originalUrl,
      timestamp: new Date().toISOString()
    }
  
    const logs = JSON.parse(fs.readFileSync(logsPath, 'utf-8'))
    logs.push(log)
  
    fs.writeFileSync(logsPath, JSON.stringify(logs, null, 2))
    next()
  }
  
  app.use(logRequest)

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
