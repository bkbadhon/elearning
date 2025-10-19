const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ["http://localhost:5173"], // your frontend URL
  credentials: true,
}));
app.use(express.json());

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.t87ip2a.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const db = client.db("talentshine");
    const usersCollection = db.collection("users");
    const coursesCollection = db.collection("courses");
    const enrollmentsCollection = db.collection("enrollments");

    // ✅ Register new user
    app.post("/register", async (req, res) => {
      try {
        const user = req.body;

        // Basic validation
        if (!user.firstName || !user.lastName || !user.email || !user.password) {
          return res.status(400).send({ message: "Missing required fields" });
        }

        // Check if email already exists
        const existing = await usersCollection.findOne({ email: user.email });
        if (existing) {
          return res.status(409).send({ message: "Email already registered" });
        }

        // Insert user
        const result = await usersCollection.insertOne(user);
        res.status(201).send({ message: "User registered successfully", result });
      } catch (error) {
        console.error("Register Error:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // ✅ Login route
    app.post("/login", async (req, res) => {
      try {
        const { phone, password } = req.body;
        const user = await usersCollection.findOne({ phone });

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        if (user.password !== password) {
          return res.status(401).send({ message: "Incorrect password" });
        }

        res.send({ message: "Login successful", user });
      } catch (error) {
        console.error("Login Error:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });


    // ✅ Get all courses
    app.get("/courses", async (req, res) => {
      try {
        const db = client.db("talentshine");
        const coursesCollection = db.collection("courses");
        const courses = await coursesCollection.find().toArray();
        res.send(courses);
      } catch (error) {
        console.error("Courses Fetch Error:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.post("/enroll", async (req, res) => {
      try {
        const { userId, courseId } = req.body;

        if (!userId || !courseId) {
          return res.status(400).send({ success: false, message: "User ID and Course ID required" });
        }

        // Convert IDs to ObjectId
        const userObjId = new ObjectId(userId);
        const courseObjId = new ObjectId(courseId);

        // Fetch user and course
        const user = await usersCollection.findOne({ _id: userObjId });
        const course = await coursesCollection.findOne({ _id: courseObjId });

        if (!user || !course) {
          return res.status(404).send({ success: false, message: "User or Course not found" });
        }

        const price = Number(course.price || 0);
        const balance = Number(user.balance || 0);

        if (balance < price) {
          return res.status(400).send({
            success: false,
            message: `Insufficient balance. You need ৳${price - balance} more to enroll.`
          });
        }

        // Deduct balance
        const updatedBalance = balance - price;
        await usersCollection.updateOne(
          { _id: userObjId },
          { $set: { balance: updatedBalance } }
        );

        // Save enrollment including course details
        const enrollment = {
          userId: user._id,
          userName: `${user.firstName} ${user.lastName}`,
          userPhone: user.phone || "",
          courseId: course._id,
          courseTitle: course.title,
          coursePrice: price,
          courseImage: course.image || "",
          courseDescription: course.description || "",
          courseTopics: course.topics || [],
          googleMeetLink: course.googleMeet || "", // make sure each course has this
          date: new Date(),
        };

        const result = await enrollmentsCollection.insertOne(enrollment);

        res.send({
          success: true,
          message: "Enrolled successfully",
          balance: updatedBalance,
          enrollment: { ...enrollment, _id: result.insertedId }
        });
      } catch (error) {
        console.error("Enroll Error:", error);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    app.get("/enrollments", async (req, res) => {
      try {
        const { userId } = req.query;
        if (!userId) return res.status(400).send({ message: "User ID required" });

        const userEnrollments = await enrollmentsCollection
          .find({ userId: new ObjectId(userId) })
          .toArray();

        res.send(userEnrollments);
      } catch (error) {
        console.error("Enrollments Fetch Error:", error);
        res.status(500).send({ message: "Server error" });
      }
    });





    // ✅ Root test
    app.get("/", (req, res) => {
      res.send({ message: "Welcome to Talent Shine BD Server" });
    });

    console.log("✅ MongoDB Connected Successfully");
  } catch (err) {
    console.error("DB Connection Error:", err);
  }
}

run().catch(console.dir);

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
