const mongoose=require('mongoose');
const plm=require('passport-local-mongoose');
require('dotenv').config()

mongoose.connect(process.env.db_connect_link);

const fileSchema=mongoose.Schema({
  username:String,
  email:String,
  password:String,
  profession:String,
  documents:[
    {
      type:mongoose.Schema.Types.ObjectId,
      ref:'docs'
    }
  ],
  key:String
})

fileSchema.plugin(plm);

module.exports=mongoose.model('file',fileSchema);