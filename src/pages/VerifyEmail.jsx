export default function VerifyEmail() {
  return (
    <div className="pt-16 min-h-screen w-screen flex items-center justify-center bg-green-100">
      <div className="bg-white rounded-2xl shadow-2xl p-8 sm:p-12 w-full max-w-md text-center">
        <h2 className="text-3xl font-bold text-green-700 mb-4">
          Check Your Email 📧
        </h2>
        <p className="text-gray-600">
          We have sent a verification email to your inbox.  
          Click the link in your email to verify your account.
        </p>
        <p className="text-gray-500 mt-6">
          After verification, you will be redirected to your dashboard automatically.
        </p>
      </div>
    </div>
  );
}
