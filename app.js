const express = require('express');
const admin = require('firebase-admin');
const multer = require('multer');
const serviceAccount = require('./door-lock-d75e2-firebase-adminsdk-epapy-4d41e2d8cb.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://door-lock-d75e2.firebaseio.com',
});

// Set up Multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const app = express();
app.use(express.json());
const port = 3001;

const accountSid = 'ACc3356ecfbac1119e3a919a7dab7c94e5';
const authToken = '7cf852d67d3bad79913105baead7e562';
const client = require('twilio')(accountSid, authToken);

// Define a route to fetch data from Firestore
app.get('/getUsers', async (req, res) => {
    try {
        const db = admin.firestore();
        const data = await db.collection('users').get();
        res.json(data.docs.map(doc => doc.data()));
    } catch (error) {
        console.error('Error fetching data from Firestore:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/createRequest', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required.' });
        }

        const db = admin.firestore();
        const requestsCollection = db.collection('requests');
        const defaultStatus = 'pending';

        // Get the current server timestamp
        const serverTimestamp = admin.firestore.Timestamp.now();

        await requestsCollection.add({
            number: phoneNumber,
            status: defaultStatus,
            creationTime: serverTimestamp,
        });

        res.status(200).json({ success: true, message: 'Phone number added to requests.' });
    } catch (error) {
        console.error('Error adding request to Firestore:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/generateOTP', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required.' });
        }

        const db = admin.firestore();
        const usersCollection = db.collection('users');
        const otpsCollection = db.collection('otp');

        // Check if the phone number is associated with any user
        const userQuery = await usersCollection.where('phone', '==', phoneNumber).get();
        const userExists = !userQuery.empty;

        if (userExists) {
            // Generate a 4-digit OTP
            const otpCode = Math.floor(1000 + Math.random() * 9000);

            // Set OTP expiration date to 15 minutes from now
            const expirationDate = new Date();
            expirationDate.setMinutes(expirationDate.getMinutes() + 15);

            // Extract phone number directly from the userQuery
            const userPhone = userQuery.docs[0].data().phone;

            client.messages
                .create({
                    body: 'Welcome! Your OTP for the JOSTUM Door lock system is ' + otpCode + '. Please do not share this code with anyone.',
                    messagingServiceSid: 'MG73775ae38c1a8c28840814e3acecdb2b',
                    to: '+2348169119835'
                })
                .then(message => console.log(message.sid))
                .done();

            // Add OTP to the OTP collection
            await otpsCollection.add({
                code: otpCode.toString(),
                phoneNumber: userPhone, // Add the associated phone number to the OTP document
                expirationDate: expirationDate.toISOString(), // Set the expiration date
            });

            res.status(200).json({ success: true, message: 'OTP generated and added to collection.' });

        } else {
            // Create a registration request
            const requestsCollection = db.collection('requests');
            const defaultStatus = 'pending';

            // Get the current server timestamp
            const serverTimestamp = admin.firestore.Timestamp.now();

            await requestsCollection.add({
                number: phoneNumber,
                status: defaultStatus,
                creationTime: serverTimestamp,
            });

            res.status(200).json({ success: true, message: 'Registration request added to collection.' });
        }
    } catch (error) {
        console.error('Error generating OTP or creating request:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/verifyOTP', async (req, res) => {
    try {
        const { phoneNumber, otpCode } = req.body;

        // Validate phone number format and OTP format
        if (!phoneNumber || !otpCode || !isValidOTP(otpCode)) {
            return res.status(400).json({ error: 'Invalid phone number or OTP format.' });
        }

        const db = admin.firestore();
        const otpsCollection = db.collection('otp');
        const historyCollection = db.collection('history');

        // Check if the provided OTP is valid for the given phone number
        const otpQuery = await otpsCollection
            .where('phoneNumber', '==', phoneNumber)
            .where('code', '==', otpCode)
            // .where('expirationDate', '>=', new Date().toISOString())
            .get();

        const validOTP = !otpQuery.empty;

        if (validOTP) {
            // OTP is valid, you can proceed with your authentication logic here
            const otpDoc = otpQuery.docs[0].data();
            await historyCollection.add({
                code: otpDoc.code,
                phoneNumber: otpDoc.phoneNumber,
                verificationTime: admin.firestore.FieldValue.serverTimestamp(),
            });

            // Optional: Delete the used OTP from the collection
            const otpDocId = otpQuery.docs[0].id;
            await otpsCollection.doc(otpDocId).delete();

            res.status(200).json({ success: true, message: 'OTP verified successfully.' });
        } else {
            res.status(400).json({ error: 'Invalid OTP or expired.' });
        }
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/uploadImage', async (req, res) => {
    try {
        const db = admin.firestore();
        const imagesCollection = db.collection('images');

        // Extract base64-encoded image from the request body
        const base64Image = req.body.image;

        // Save the base64 image to the "images" collection
        await imagesCollection.add({
            image: base64Image,
            uploadTime: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.status(200).json({ success: true, message: 'Image uploaded successfully.' });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Validate OTP format (4 digits)
function isValidOTP(otpCode) {
    return /^\d{4}$/.test(otpCode);
}


// Start the Express server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
