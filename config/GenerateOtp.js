const Mailer = require("./SendMail.js");

const defaultText = `Dear User,

Your OTP (One-Time Password) is: {otp}

Please use this OTP to complete your verification process. This OTP will expire in 5 minutes.

If you did not request this, please ignore this email.

Best regards,
[KhataBook]`;

class Otp {
    constructor(UserMail, SenderMail, UserId, Subject = "OTP Verification Code", Text = defaultText) {
        this.mail = new Mailer(process.env.ADMIN_EMAIL, process.env.EMAIL_PASS);
        this.UserEmail = UserMail;
        this.SenderMail = SenderMail;
        this.Subject = Subject;
        this.Text = Text;
        this.otp = null;
        this.id = UserId;
        this.otpCreatedAt = null;
    }

    async GenerateOtp() {
        try {
            this.otp = Math.floor(100000 + Math.random() * 900000);
            this.otpCreatedAt = new Date();
            console.log(this.otp)
            const emailText = this.Text.replace("{otp}", this.otp);
            await this.mail.SendMail(this.UserEmail, this.SenderMail, this.Subject, emailText);

        } catch (err) {
            console.error("Error generating or sending OTP:", err);
            throw new Error("Failed to generate or send OTP. Please try again later.");
        }
    }

    async VerifyOtp(UserOtp) {
        try {
            if (!this.otp) {
                return new Error("OTP has expired. Please request a new one.");
            }

            // Check if OTP is expired (1 minutes)
            const now = new Date();
            const diffInMs = now - this.otpCreatedAt;
            if (diffInMs > 60000) { // 1 minutes = 60,000 ms
                this.otp = null;
                this.otpCreatedAt = null;
                throw new Error("OTP has expired. Please request a new one.");
            }

            const isValid = String(this.otp) === String(UserOtp);

            if (isValid) {
                this.otp = null;
                this.otpCreatedAt = null;
            }

            return isValid;

        } catch (err) {
            console.error("Error verifying OTP:", err);
            throw new Error(err.message || "OTP verification failed. Please try again.");
        }
    }
}

module.exports = Otp;
