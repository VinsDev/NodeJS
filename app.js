const express = require('express');
const admin = require('firebase-admin');
const serviceAccount = require('./door-lock-d75e2-firebase-adminsdk-epapy-4d41e2d8cb.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://door-lock-d75e2.firebaseio.com',
});

const app = express();
const port = 3001;

// Define a route to fetch data from Firestore
app.get('/getData', async (req, res) => {
    try {
        const db = admin.firestore();
        const data = await db.collection('users').get();
        res.json(data.docs.map(doc => doc.data()));
    } catch (error) {
        console.error('Error fetching data from Firestore:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
