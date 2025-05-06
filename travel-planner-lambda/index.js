const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

const dynamoDB = new AWS.DynamoDB.DocumentClient({ region: 'eu-north-1' });

// Directly using the Cohere API key
const COHERE_API_KEY = 'T2iWHmS3Nv9iMkqBMVIfW1ZVxyGUQYeqsdv6r0wU'; // Replace with your actual API key

exports.handler = async (event) => {
  console.log("Lambda triggered. Event:", JSON.stringify(event));

  // Get the origin from the request headers
  const requestOrigin = event.headers?.origin || event.headers?.Origin;
  
  // Allow both your Amplify and old S3 URLs (or use '*' for development)
  const allowedOrigins = [
    'https://your-amplify-url.amplifyapp.com', // Replace with your actual Amplify URL
    'http://ccl-miniproject31.s3-website.eu-north-1.amazonaws.com'
  ];

  // Set CORS headers based on the request origin
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Origin": allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0],
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
    "Access-Control-Allow-Credentials": true
  };

  // Handle preflight (OPTIONS) request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight success' })
    };
  }

  try {
    // Parsing the input body
    const body = JSON.parse(event.body);
    const { location, budget, duration, ageGroup, transport } = body;

    console.log("Parsed input:", { location, budget, duration, ageGroup, transport });

    // Generate the prompt for Cohere API
    const prompt = `Give me a short ${duration}-day travel plan for a trip to ${location} for someone aged ${ageGroup}, with a ${budget} budget, traveling by ${transport}. Keep it under 300 words and suggest local, budget-friendly activities.`;

    // Making the API call to Cohere
    const cohereResponse = await axios.post(
      'https://api.cohere.ai/generate',
      {
        model: "command",
        prompt: prompt,
        max_tokens: 300,
        temperature: 0.7
      },
      {
        headers: {
          'Authorization': `Bearer ${COHERE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 25000
      }
    );

    const responseText = cohereResponse?.data?.text;
    const generatedPlan = responseText
      ? responseText.trim()
      : "Sorry, we couldn't generate a travel plan at this time.";

    const id = uuidv4();

    const item = {
      id,
      location,
      budget,
      duration,
      ageGroup,
      transport,
      generatedPlan,
      timestamp: Date.now()
    };

    console.log("Writing to DynamoDB:", item);

    await dynamoDB.put({
      TableName: 'TravelPlans',
      Item: item
    }).promise();

    console.log("PutItem succeeded");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, data: item })
    };

  } catch (error) {
    console.error("Error occurred:", error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.response?.data?.message || error.message 
      })
    };
  }
};