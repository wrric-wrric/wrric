import { NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  const resend = new Resend(process.env.NEXT_PUBLIC_RESEND_API_KEY || "");
  
  try {
    const { user_id, name, email, feedback } = await request.json();

    if (!feedback) {
      return NextResponse.json(
        { success: false, message: "Feedback is required" },
        { status: 422 }
      );
    }

    // Send feedback email to you
    await resend.emails.send({
      from: "Labs Feedback <onboarding@resend.dev>", // you can configure your domain later
      to: process.env.NEXT_PUBLIC_FEEDBACK_RECEIVER as string,
      subject: `New Feedback from ${name || "Anonymous"}`,
      text: `
          User ID: ${user_id || "N/A"}
          Name: ${name || "Anonymous"}
          Email: ${email || "Not provided"}

          Feedback:
          ${feedback}
                `,
                html: `
          <h2>New Feedback Submission</h2>
          <p><strong>User ID:</strong> ${user_id || "N/A"}</p>
          <p><strong>Name:</strong> ${name || "Anonymous"}</p>
          <p><strong>Email:</strong> ${email || "Not provided"}</p>
          <h3>Feedback:</h3>
          <p>${feedback.replace(/\n/g, "<br>")}</p>
                `,
              });

              // (Optional) send confirmation email to user
              if (email) {
                await resend.emails.send({
                  from: "Labs Team <onboarding@resend.dev>",
                  to: email,
                  subject: "Thanks for your feedback!",
                  text: `
          Hi ${name || "there"},

          Thank you for sending us your feedback. We’ve received it and will review it soon.

          Best,
          Labs Team
                  `,
                  html: `
          <h2>Thanks for your feedback!</h2>
          <p>Hi ${name || "there"},</p>
          <p>Thank you for sending us your feedback. We’ve received it and will review it soon.</p>
          <p>Best,<br/>Labs Team</p>
        `,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Feedback submitted successfully",
    });
  } catch (error) {
    console.error("Feedback error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to send feedback" },
      { status: 500 }
    );
  }
}
