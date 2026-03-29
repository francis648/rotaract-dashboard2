document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("memberForm");
  const modal = document.getElementById("successModal");
  const errorMsg = document.getElementById("errorMsg");

  form.addEventListener("submit", async function (e) {
    e.preventDefault(); // prevent page reload

    // Collect form data
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      // Use relative path locally, full backend URL when deployed
      const response = await fetch(
        "https://rotaract-dashboard2.onrender.com",  
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        }
      );

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
