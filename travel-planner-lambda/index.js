const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const AWS = require('aws-sdk');

const dynamoDB = new AWS.DynamoDB.DocumentClient({ region: 'eu-north-1' });

// Environment variables (set in Lambda configuration)
const COHERE_API_KEY = process.env.COHERE_API_KEY || 'T2iWHmS3Nv9iMkqBMVIfW1ZVxyGUQYeqsdv6r0wU';
const ALLOWED_ORIGINS = [
  'https://d3vef5cubamhc3.amplifyapp.com', // Your Amplify URL
  'http://ccl-miniproject31.s3-website.eu-north-1.amazonaws.com' // Your S3 URL
];

exports.handler = async (event) => {
  console.log("Lambda triggered. Event:", JSON.stringify(event));

  // Get the request origin
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';
  
  // Set CORS headers
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(requestOrigin) ? requestOrigin : ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
    "Access-Control-Allow-Credentials": true,
    "Content-Type": "application/json"
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
    // Validate request
    if (!event.body) {
      throw new Error("Missing request body");
    }

    // Parse and validate input
    const body = JSON.parse(event.body);
    const { location, budget, duration, ageGroup, transport } = body;

    if (!location || !budget || !duration || !ageGroup || !transport) {
      throw new Error("Missing required fields");
    }

    console.log("Validated input:", { location, budget, duration, ageGroup, transport });

    // Generate the prompt for Cohere API
    const prompt = `Create a detailed ${duration}-day travel itinerary for ${location} for ${ageGroup} year olds with a ${budget} budget using ${transport}. Include: 
    - Daily activities
    - Budget-friendly dining options
    - Transportation tips
    - Cultural highlights
    Keep response under 300 words.`;

    // Call Cohere API
    const cohereResponse = await axios.post(
      'https://api.cohere.ai/generate',
      {
        model: "command",
        prompt: prompt,
        max_tokens: 350,
        temperature: 0.7,
        truncate: "END"
      },
      {
        headers: {
          'Authorization': `Bearer ${COHERE_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000
      }
    );

    const responseText = cohereResponse?.data?.generations?.[0]?.text || 
                       cohereResponse?.data?.text || 
                       "Sorry, we couldn't generate a travel plan at this time.";

    const generatedPlan = responseText.trim();

    // Save to DynamoDB
    const item = {
      id: uuidv4(),
      location,
      budget,
      duration,
      ageGroup,
      transport,
      generatedPlan,
      timestamp: Date.now(),
      ipAddress: event.requestContext?.identity?.sourceIp || 'unknown'
    };

    await dynamoDB.put({
      TableName: 'TravelPlans',
      Item: item,
      ConditionExpression: "attribute_not_exists(id)" // Prevent overwrites
    }).promise();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        success: true, 
        data: {
          ...item,
          generatedPlan: generatedPlan.replace(/\n/g, '<br>') // Format line breaks for HTML
        }
      })
    };

  } catch (error) {
    console.error("Error occurred:", error);
    
    return {
      statusCode: error.response?.status || 500,
      headers,
      body: JSON.stringify({ 
        success: false, 
        error: error.response?.data?.message || error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};