document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("memberForm");
  const modal = document.getElementById("successModal");
  const errorMsg = document.getElementById("errorMsg");

  // ✅ API base URL logic
  // In production, set <body data-api-url="https://rotaract-dashboard2.onrender.com">
  const API_BASE = window.location.hostname.includes("localhost")
    ? "http://localhost:3000"
    : document.body.dataset.apiUrl || "https://rotaract-dashboard2.onrender.com";

  form.addEventListener("submit", async function (e) {
    e.preventDefault(); // prevent page reload

    // Collect form data
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      // Send to backend /submit route
      const response = await fetch(`${API_BASE}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"   // ✅ ensures cookies persist
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Server error (${response.status}): ${text}`);
      }

      const result = await response.json();

      if (result.message && result.message.includes("successfully")) {
        // Show success modal
        modal.style.display = "flex";

        // Auto redirect after 5 seconds
        setTimeout(() => {
          modal.style.display = "none";
          form.reset();
          window.location.href = "/admin.html"; // redirect to dashboard
        }, 5000);
      } else {
        errorMsg.textContent = result.message || "Submission failed.";
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      errorMsg.textContent = "Error submitting form. Please try again.";
    }
  });

  // Close modal and reset form
  window.closeModal = function () {
    modal.style.display = "none";
    form.reset();
  };
});
