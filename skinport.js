const clientId = '61360a86f2cb47e88ed3cc5da7c04dab';
const clientSecret = 'dzEJqeUPEWcmbSxFrnQyhjATkoAuax50FO+e9K9o0w6IzPS5PxmkqQmJbbyJ6IcNNijrFAqoHd4E5E6QyI7opA==';

// Combine Client ID and Client Secret with a colon
const encodedData = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

// Generate the Authorization header
const authorizationHeaderString = `Authorization: Basic ${encodedData}`;



console.log(authorizationHeaderString);