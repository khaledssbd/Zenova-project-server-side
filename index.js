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
    'https://zenovaaz.vercel.app',
    'https://zenovaaz.web.app',
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

    // Get product details
    app.get('/product-details/:id', async (req, res) => {
      const Id = req.params.id;
      const query = { _id: new ObjectId(Id) };
      const result = await productCollection.findOne(query);
      res.send(result);
    });

    // get my product
    app.get('/my-products', verifyToken, async (req, res) => {
      // use req?.query?.email istead of req?.user?.email
      // because in verifyToken there is no req.user.email
      const result = await productCollection
        .find({ sellerEmail: req?.query?.email })
        .toArray();
      res.send(result);
    });

    // update a product
    app.patch('/update-product/:id', verifyToken, async (req, res) => {
      const ID = req.params.id;
      const query = { _id: new ObjectId(ID) };
      const result = await productCollection.updateOne(query, {
        $set: req.body,
      });
      res.send(result);
    });

    // delete a product
    app.delete('/delete-product/:id', verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productCollection.deleteOne(query);
      res.send(result);
    });

    // Get products by pagination
    app.get('/all-products-by-pagination', async (req, res) => {
      const size = parseInt(req.query.size);
      const skipablePage = parseInt(req.query.page) - 1;
      const sortPrice = req.query.sortPrice;
      const sortDate = req.query.sortDate;
      const minPrice = parseInt(req.query.minPrice);
      const maxPrice = parseInt(req.query.maxPrice);
      const category = req.query.category;


      let filter = {};
      // Case 1: Filter by category only
      if (category && isNaN(minPrice) && isNaN(maxPrice)) {
        filter = { category: category };
      }

      // Case 2: Filter by price range only
      if (!isNaN(minPrice) && !isNaN(maxPrice) && !category) {
        filter = { price: { $lte: maxPrice, $gte: minPrice } };
      }

      // Case 3: Filter by price range and category
      if (!isNaN(minPrice) && !isNaN(maxPrice) && category) {
        filter = {
          price: { $lte: maxPrice, $gte: minPrice },
          category: category,
        };
      }

      let options = {};
      if (sortPrice) {
        options = { sort: { price: sortPrice === 'asc' ? 1 : -1 } };
      }
      if (sortDate) {
        options = { sort: { date_Time: sortDate === 'asc' ? 1 : -1 } };
      }

      const result = await productCollection
        .find(filter, options)
        .skip(skipablePage * size)
        .limit(size)
        .toArray();

      res.send(result);
    });

    // Get products count
    app.get('/products-count', async (req, res) => {
      const minPrice = parseInt(req.query.minPrice);
      const maxPrice = parseInt(req.query.maxPrice);
      const category = req.query.category;

      let filter = {};
      // Case 1: Filter by category only
      if (category && isNaN(minPrice) && isNaN(maxPrice)) {
        filter = { category: category };
      }

      // Case 2: Filter by price range only
      if (!isNaN(minPrice) && !isNaN(maxPrice) && !category) {
        filter = { price: { $lte: maxPrice, $gte: minPrice } };
      }

      // Case 3: Filter by price range and category
      if (!isNaN(minPrice) && !isNaN(maxPrice) && category) {
        filter = {
          price: { $lte: maxPrice, $gte: minPrice },
          category: category,
        };
      }
      const count = await productCollection.countDocuments(filter);
      res.send({ count });
    });

    // Get search results
    app.get('/search-products', async (req, res) => {
      const search = req.query.search;
      const query = {
        name: { $regex: search, $options: 'i' },
      };
      const result = await productCollection.find(query).toArray();

      res.send(result);
    });

    // Send a ping to confirm a successful connection to DB
    // await client.db('admin').command({ ping: 1 });
    // console.log(
    //   'Pinged your deployment. You successfully connected to MongoDB!'
    // );
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
