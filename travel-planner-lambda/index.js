const AWS = require('aws-sdk');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const dynamoDB = new AWS.DynamoDB.DocumentClient({ region: 'eu-north-1' });
const COHERE_API_KEY = 'T2iWHmS3Nv9iMkqBMVIfW1ZVxyGUQYeqsdv6r0wU';

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key",
    "Access-Control-Allow-Methods": "OPTIONS,POST",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json"
  };

  // Handle CORS preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'CORS preflight successful' })
    };
  }

  try {
    // Check if the body exists and is valid JSON
    if (!event.body) {
      throw new Error("Missing request body");
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch (jsonError) {
      throw new Error("Invalid JSON in request body");
    }

    const { location, budget, duration, ageGroup, transport } = body;

    // Validate required fields
    if (!location || !budget || !duration || !ageGroup || !transport) {
      throw new Error("Missing required fields: location, budget, duration, ageGroup, or transport");
    }

    // Generate the prompt for the travel plan
    const prompt = `Create a detailed ${duration}-day travel itinerary for ${location} for ${ageGroup} year olds with a ${budget} budget using ${transport}. Include: 
    - Daily activities
    - Budget-friendly dining options
    - Transportation tips
    - Cultural highlights
    Keep response under 1000 words.`;

    // Call the Cohere API to generate the travel plan
    const cohereResponse = await axios.post(
      'https://api.cohere.ai/generate',
      {
        model: "command",
        prompt,
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

    // Extract the generated plan text
    const responseText = cohereResponse?.data?.generations?.[0]?.text || 
                         cohereResponse?.data?.text || 
                         "Sorry, we couldn't generate a travel plan at this time.";

    const generatedPlan = responseText.trim();

    // Prepare item to store in DynamoDB
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

    // Insert the item into DynamoDB
    await dynamoDB.put({
      TableName: 'TravelPlans',
      Item: item,
      ConditionExpression: "attribute_not_exists(id)" // Prevent overwriting existing items
    }).promise();

    // Return successful response
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        data: {
          ...item,
          generatedPlan: generatedPlan // Format for display
        }
      })
    };

  } catch (error) {
    console.error("Error occurred:", error);

    // Return error response
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: error.message })
    };
  }
};
