const express = require('express');
const admin = require('firebase-admin');
const serviceAccount = require('./door-lock-d75e2-firebase-adminsdk-epapy-4d41e2d8cb.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://door-lock-d75e2.firebaseio.com',
});

const app = express();
app.use(express.json());
const port = 3001;

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

// Start the Express server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
