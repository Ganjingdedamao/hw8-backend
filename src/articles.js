let Article=require('./model.js').Article
let Comment=require('./model.js').Comment
let Profile=require('./model.js').Profile
const getUser=require('./auth.js').getUser
const uploadImagetoArticle = require('./uploadCloudinary').uploadImagetoArticle
let cookieKey = 'sid'
//add one article
const addArticle = (req, res) => {
  if(!req.username){
    res.status(401).send('You have not logged in')
    return
  }
  let newId
  if(req.text){
    Article.find().exec(function(err, arts) {
      newId=arts.length+1
      new Article({
        _id : newId,
        author: req.username,
        text: req.text,
        date: new Date(),
        img: req.fileurl,
        comments: []
      }).save(function() {
      Article.find({_id:newId}).exec(function(err, arts) {
          console.log(arts)
          res.send({articles:arts})
        })
      })
    })
  } else{
    res.status(400).send('Error: no article text')
  }
}
// get articles
const getArticles = (req, res) => {
  if(!req.username){
    res.status(401).send('You have not logged in')
    return
  }
  if(req.params.id){
    Article.find({_id : req.params.id}).exec(function(err, arts) {
      res.send({articles: arts})
    })
  } else {
    Profile.find({ username : req.username }).exec(function(err, users){//find followers in profile
      if (err) {
        res.status(401).send('Error: can not get user')
      } else {
        const userObj=users[0]
        const usersToQuery = [ userObj.username, ...userObj.following ]//get usersToQuery 
        getArticlesByAuthors({ authors: usersToQuery, limit: 10 }, function(err, arts){//get 10 articles
          if(err)
          {   
            res.status(400).send('Error: can not get articles')
          }
          else{
            console.log(arts)
            res.send({articles: arts})
          }
        })
      }
    })
  }
}

const getArticlesByAuthors = (queryinfo, callback) =>{//get 10 articles ordered by date
  Article.find({ author: { $in: queryinfo.authors } }).sort( { date: -1 } )
  .limit(queryinfo.limit).exec(function(err, arts) { 
    if (err) {//err
      callback(err, null)
    } else {//send articles
      callback(null,arts)
    }
  })
}

//edit article, add comment or edit comment
const putArticle= (req, res) =>{
  if(!req.username){
    res.status(401).send('You have not logged in')
    return
  }
  if(!req.body.text){
    res.status(400).send('Error: no article text')
    return
  }
  Article.find({_id:req.params.id}).exec(function(err, arts){// check if id is valid
    if(arts == null || arts.length == 0) {
      res.status(401).send('Error: no such article')
      return
    }
    if(req.body.commentId){//put comment
      if(req.body.commentId==-1){//add comment
        let newId
        Comment.find().exec(function(err, comms) {
          newId = comms.length + 1
          new Comment({  commentId : newId,  author: req.username,  date: new Date(),  text: req.body.text  }).save(function(){
            Article.find({ _id : req.params.id }).exec(function(err, arts) {
              Comment.find({ commentId : newId }).exec(function(err, comms) {
                let newcomments=[...arts[0].comments, comms[0] ]
                Article.update({ _id : req.params.id }, { comments : newcomments}).exec(function(err, arts) {
                  Article.find({ _id : req.params.id }).exec(function(err, arts) {
                    res.send({ articles: arts })
                  })
                })
              }) 
            })
          })
        })
      }
      else{//edit comment
        Comment.update({ commentId : req.body.commentId }, { text : req.body.text}).exec(function(){
          Article.find({ _id : req.params.id }).exec(function(err, arts) {
            Comment.find({ commentId : req.body.commentId }).exec(function(err, comms) {
              let newcomments=arts[0].comments.map((c)=> c.commentId==req.body.commentId? {commentId: c.commentId, author: c.author, text: req.body.text}: c)
              Article.update({ _id : req.params.id }, { comments : newcomments}).exec(function(){
                Article.find({ _id : req.params.id }).exec(function(err, arts) {
                  res.send({ articles: arts })
                })
              })
            })
          })
        })
      }
    }
    else{//edit article
      Article.update({ _id : req.params.id }, { text : req.body.text}).exec(function(){
        Article.find({ _id : req.params.id }).exec(function(err, arts) {
          res.send({ articles: arts })
        })
      })
    }
  })
}

module.exports = (app) => {
  app.get('/articles/:id*?', getArticles)
  app.post('/article', uploadImagetoArticle("img"), addArticle)
  app.put('/articles/:id', putArticle)
}
