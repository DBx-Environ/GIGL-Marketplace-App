// Import 2nd Gen functions specifically
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { region } = require("firebase-functions/v2/options"); // For setting region with 2nd Gen
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK (required for interacting with Firestore)
admin.initializeApp();

// Get Firestore instance
const db = admin.firestore();

// --- Configure Resend API Key ---
// IMPORTANT: These are now read directly from process.env for 2nd Gen Functions.
// You will set these in the GitHub Actions workflow directly.
const resendApiKey = process.env.RESEND_API_KEY;
const contactEmail = process.env.CONTACT_EMAIL;
const senderEmail = process.env.SENDER_EMAIL;

// Use the APP_ID from environment variables for Firestore paths
// This matches REACT_APP_MY_APP_ID_FOR_FIRESTORE_PATHS from the frontend
const APP_ID_FOR_FIRESTORE = process.env.MY_APP_ID_FOR_FIRESTORE_PATHS;


/**
 * Helper function to send email via Resend API.
 * @param {string} fromEmail - The sender's email address
 * (must be verified in Resend).
 * @param {string} toEmail - The recipient's email address.
 * @param {string} subject - The subject line of the email.
 * @param {string} htmlContent - The HTML body of the email.
 */
async function sendEmailResend(fromEmail, toEmail, subject, htmlContent) {
  const RESEND_API_URL = "https://api.resend.com/emails";

  try {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: `GIGL Marketplace <${fromEmail}>`, // Sender email
        to: [toEmail], // Array of recipients
        subject: subject,
        html: htmlContent,
      }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log("Email sent successfully via Resend to:", toEmail, data);
    } else {
      console.error(
          "Error sending email via Resend to",
          toEmail,
          ":",
          response.status,
          data,
      );
      throw new Error(
          `Resend API Error: ${response.status} - ` +
          `${data.message || JSON.stringify(data)}`,
      );
    }
  } catch (error) {
    console.error("Caught error sending email via Resend:", error);
  }
}

/**
 * Cloud Function triggered on bid write (create, update, delete).
 * Sends email notifications for bid actions.
 * @param {object} event - The CloudEvent from the Firestore trigger.
 */
exports.sendBidNotificationEmail = onDocumentWritten(
  {
    document: `artifacts/${APP_ID_FOR_FIRESTORE}/public/data/bids/{bidId}`, // <--- Uses APP_ID_FOR_FIRESTORE
    region: "europe-west2",
  },
  async (event) => {
    const bidId = event.params.bidId;
    // const appId = event.params.appId; // Removed - now using APP_ID_FOR_FIRESTORE

    const oldBid = event.data.before.exists ? event.data.before.data() : null;
    const newBid = event.data.after.exists ? event.data.after.data() : null;

    let emailSubject = "";
    let emailContent = "";
    let recipientEmail = "";
    let opportunityTitle = "";
    let bidAmount = 0;
    let bidderEmail = ""; // To send to the bidder

    // Determine the action (create, update, delete) and gather data
    if (!event.data.after.exists) { // Delete operation
      console.log(`Bid ${bidId} deleted.`);
      opportunityTitle = oldBid.opportunityTitle;
      bidAmount = oldBid.bidAmount;
      // Assuming you store bidderEmail in bid doc for deleted bids
      bidderEmail = oldBid.bidderEmail;
      recipientEmail = bidderEmail ||
        "unknown-bidder@example.com"; // Fallback
      emailSubject = `Bid Withdrawn: ${opportunityTitle}`;
      emailContent = `
        <p>Your bid of <b>$${bidAmount}</b> for "${opportunityTitle}" has been
        successfully withdrawn.</p>
        <p>If you did not initiate this, please contact us immediately.</p>
        <p>Thank you,</p>
        <p>GIGL Marketplace Team</p>
      `;
    } else if (!event.data.before.exists) { // Create operation
      console.log(`New bid ${bidId} created.`);
      opportunityTitle = newBid.opportunityTitle;
      bidAmount = newBid.bidAmount;
      // Fetch bidder's email from the 'users' collection
      const bidderDoc = await db.collection(`artifacts/${APP_ID_FOR_FIRESTORE}/users`) // <--- Uses APP_ID_FOR_FIRESTORE
          .doc(newBid.bidderId).get();
      bidderEmail = bidderDoc.exists ?
        bidderDoc.data().email :
        "unknown-bidder@example.com";

      recipientEmail = bidderEmail;
      emailSubject = `New Bid Placed: ${opportunityTitle}`;
      emailContent = `
        <p>You have successfully placed a new bid of <b>$${bidAmount}</b> for
        "${opportunityTitle}".</p>
        <p>We will notify you of any updates.</p>
        <p>Thank you,</p>
        <p>GIGL Marketplace Team</p>
      `;
    } else { // Update operation
      console.log(`Bid ${bidId} updated.`);
      opportunityTitle = newBid.opportunityTitle;
      bidAmount = newBid.bidAmount;
      const oldBidAmount = oldBid.bidAmount;
      // Fetch bidder's email from the 'users' collection
      const bidderDoc = await db.collection(`artifacts/${APP_ID_FOR_FIRESTORE}/users`) // <--- Uses APP_ID_FOR_FIRESTORE
          .doc(newBid.bidderId).get();
      bidderEmail = bidderDoc.exists ?
        bidderDoc.data().email :
        "unknown-bidder@example.com";

      recipientEmail = bidderEmail;
      emailSubject = `Bid Updated: ${opportunityTitle}`;
      emailContent = `
        <p>Your bid for "${opportunityTitle}" has been updated from
        <b>$${oldBidAmount}</b> to <b>$${bidAmount}</b>.</p>
        <p>Thank you,</p>
        <p>GIGL Marketplace Team</p>
      `;
    }

    // Send email to the bidder
    await sendEmailResend(
        senderEmail,
        recipientEmail,
        emailSubject,
        emailContent,
    );

    // Send a copy/summary email to the CONTACT_EMAIL
    const summarySubject = `[GIGL Admin] ${emailSubject} by ${bidderEmail}`;
    const summaryContent = `
      <p>An action occurred on a bid:</p>
      <ul>
        <li><b>Bid ID:</b> ${bidId}</li>
        <li><b>Opportunity:</b> ${opportunityTitle}</li>
        <li><b>Bid Amount:</b> $${bidAmount}</li>
        <li><b>Bidder Email:</b> ${bidderEmail}</li>
        <li><b>Action:</b> ${!event.data.after.exists ?
          "Withdrawal" :
          (!event.data.before.exists ? "New Bid" : "Update Bid")}</li>
      </ul>
      ${emailContent}
    `;
    await sendEmailResend(
        senderEmail,
        contactEmail,
        summarySubject,
        summaryContent,
    );

    return null; // Cloud Functions should return null or a Promise
  });
