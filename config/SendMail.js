const nodemailer = require("nodemailer");

/**
 * Mailer class for handling email operations
 */
class Mailer {
    /**
     * Create a new Mailer instance
     * @param {string} Email - Email address to send from
     * @param {string} Password - Password for the email account
     */
    constructor(Email, Password) {
        this.Email = Email;
        this.Password = Password;
        
        // Create the transporter with Gmail service
        this.transporter = nodemailer.createTransport({
            service: 'gmail',  
            auth: {
                user: this.Email,
                pass: this.Password,
            },
            // Adding some security and reliability options
            tls: {
                rejectUnauthorized: true
            },
            pool: true, // Use pooled connections
            maxConnections: 5, // Maximum number of concurrent connections
            maxMessages: 100 // Maximum number of messages to send per connection
        });
    }

    /**
     * Send a plain text email
     * @param {string} UserEmail - Recipient email address
     * @param {string} OurEmail - Sender email address
     * @param {string} subject - Email subject
     * @param {string} text - Email body text
     * @returns {Promise} - Resolution of send operation
     */
    async SendMail(UserEmail, OurEmail, subject, text) {
        const mailOptions = {
            to: UserEmail,
            from: {
                name: "UnifHub Team", // Add a display name
                address: OurEmail
            },
            subject: subject,
            text: text,
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log("Email sent successfully! Message ID:", info.messageId);
            return info;
        } catch (error) {
            console.error("Error sending email:", error);
            throw error; // Re-throw to allow handling by caller
        }
    }

    /**
     * Send an email with both HTML and plain text content
     * @param {string} UserEmail - Recipient email address 
     * @param {string} OurEmail - Sender email address
     * @param {string} subject - Email subject
     * @param {string} text - Plain text version of email body
     * @param {string} html - HTML version of email body
     * @returns {Promise} - Resolution of send operation
     */
    async SendMailHTML(UserEmail, OurEmail, subject, text, html) {
        const mailOptions = {
            to: UserEmail,
            from: {
                name: "UnifHub Team", // Add a display name
                address: OurEmail
            },
            subject: subject,
            text: text, // Plain text fallback
            html: html, // HTML body
            headers: {
                'X-Priority': '1', // Set priority
                'X-MSMail-Priority': 'High',
                'Importance': 'High'
            }
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log("HTML Email sent successfully! Message ID:", info.messageId);
            return info;
        } catch (error) {
            console.error("Error sending HTML email:", error);
            throw error; // Re-throw to allow handling by caller
        }
    }

    /**
     * Send email with attachments
     * @param {string} UserEmail - Recipient email address
     * @param {string} OurEmail - Sender email address
     * @param {string} subject - Email subject
     * @param {string} text - Plain text version of email body
     * @param {string} html - HTML version of email body
     * @param {Array} attachments - Array of attachment objects
     * @returns {Promise} - Resolution of send operation
     */
    async SendMailWithAttachments(UserEmail, OurEmail, subject, text, html, attachments) {
        const mailOptions = {
            to: UserEmail,
            from: {
                name: "UnifHub Team",
                address: OurEmail
            },
            subject: subject,
            text: text,
            html: html,
            attachments: attachments // Array of attachment objects
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log("Email with attachments sent successfully! Message ID:", info.messageId);
            return info;
        } catch (error) {
            console.error("Error sending email with attachments:", error);
            throw error;
        }
    }

    /**
     * Send email to multiple recipients
     * @param {Array} recipients - Array of recipient email addresses
     * @param {string} OurEmail - Sender email address
     * @param {string} subject - Email subject
     * @param {string} text - Plain text version of email body
     * @param {string} html - HTML version of email body
     * @returns {Promise} - Resolution of send operation
     */
    async SendBulkMail(recipients, OurEmail, subject, text, html) {
        const mailOptions = {
            to: recipients,
            from: {
                name: "UnifHub Team",
                address: OurEmail
            },
            subject: subject,
            text: text,
            html: html
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`Bulk email sent to ${recipients.length} recipients! Message ID:`, info.messageId);
            return info;
        } catch (error) {
            console.error("Error sending bulk email:", error);
            throw error;
        }
    }
}

module.exports = Mailer;