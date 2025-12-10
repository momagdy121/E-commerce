import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

export const sendEmail = async (options) => {
  const message = {
    from: "E-commerce",
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html || options.message
  };

  await transporter.sendMail(message);
};
