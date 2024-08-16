const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// all config
require('dotenv').config();
const app = express();
const port = process.env.PORT || 7000;

// all middleware
const corsConfig = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://glamspot-khaled.web.app',
    'https://glamspot-by-khaled.vercel.app',
    'https://glamspot-by-khaled.surge.sh',
    'https://glamspot-by-khaled.netlify.app',
  ],
  credentials: true,
};
app.use(cors(corsConfig));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2brfitt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// my made middlewares

const verifyToken = async (req, res, next) => {
  const token = req?.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: 'unauthorized access' });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized access' });
    }
    if (req?.query?.email !== decoded?.email) {
      return res.status(403).send({ message: 'forbidden access' });
    }
    next();
  });
};

const cookieOptions = {
  httpOnly: true,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  secure: process.env.NODE_ENV === 'production',
};

async function run() {
  try {
    const productCollection = client.db('zenovaDB').collection('products');

    // auth related API
    // gives token when user login
    app.post('/getJwtToken', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '4h',
      });
      res.cookie('token', token, cookieOptions).send({ success: true });
    });

    // deletes token when user logout
    app.post('/deleteJwtToken', async (req, res) => {
      res
        .clearCookie('token', { ...cookieOptions, maxAge: 0 })
        .send({ success: true });
    });

    // products related API
    // post a product
    app.post('/add-product', verifyToken, async (req, res) => {
      const newProduct = req.body;
      const result = await productCollection.insertOne(newProduct);
      res.send(result);
    });

    // Get all products
    app.get('/all-products', async (req, res) => {
      const result = await productCollection.find().toArray();
      res.send(result);
    });


    

    // Send a ping to confirm a successful connection to DB
    await client.db('admin').command({ ping: 1 });
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hellow! From Zenova server owner Khaled');
});

app.listen(port, () => {
  console.log(`Zenova server is running on port: ${port}`);
});
