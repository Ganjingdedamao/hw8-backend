////////////////////////////////
// Upload files to Cloudinary //
////////////////////////////////
const multer = require('multer')
const stream = require('stream')
const cloudinary = require('cloudinary')

if (!process.env.CLOUDINARY_URL) {
     process.env.CLOUDINARY_URL="cloudinary://731478341358567:E36Zg_RXjggFSwSrvo2-6VBu_9M@hzhwg6awn"
}
cloudinary.config({ 
  cloud_name: 'hzhwg6awn', 
  api_key: '731478341358567', 
  api_secret: 'E36Zg_RXjggFSwSrvo2-6VBu_9M' 
});
const doUpload = (publicId, req, res, next) => {
	console.log(publicId)
	console.log(process.env.CLOUDINARY_URL)
	const uploadStream = cloudinary.uploader.upload_stream(result => { 
         req.fileurl = result.url
         req.fileid = result.public_id
         console.log(req.fileurl)
         next()
	}, { public_id: req.body[publicId]})
	const s = new stream.PassThrough()
	s.end(req.file.buffer)
	s.pipe(uploadStream)
	s.on('end', uploadStream.end)
}

// multer parses multipart form data.  Here we tell
// it to expect a single file upload named 'image'
// Read this function carefully so you understand
// what it is doing!
const uploadImage = (publicId) => (req, res, next) =>
     multer().single('image')(req, res, () => 
               doUpload(publicId, req, res, next))

//upload image in articles
const uploadImagetoArticle = (publicId) => (req, res, next) => {
	multer().single('text')(req, res, () => {//fetch text in formdata
		if (!req.body.text||!req.body.text[0]||req.body.text[0]=="") {
			req.text = null
		}else {
     		req.text = req.body.text[0]
     	}
    })
     multer().single('image')(req, res, () =>  {//fetch image in formdata
     	if(!req.file) {
     		req.file =  null
     		next()
     	} else {
     		doUpload(publicId, req, res, next)
     	}
     })          
}

module.exports = { uploadImage, uploadImagetoArticle}

