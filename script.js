/**
 * =========================================
 * KNS Risk Solutions - Lead Capture Script
 * -----------------------------------------
 * This script handles all frontend logic for:
 * 1. Selecting a service package from pricing cards
 * 2. Validating form input before submission
 * 3. Sending form data to backend API (/api/contact)
 * 4. Providing user feedback (success/error messages)
 * =========================================
 */


/**
 * =========================================
 * DOM ELEMENT REFERENCES
 * -----------------------------------------
 * Grab key elements from the page for interaction
 * =========================================
 */
const contactForm = document.getElementById("contact-form");     // Main form element
const formStatus = document.getElementById("form-status");       // Status message area (success/error)
const submitButton = document.getElementById("submit-button");   // Submit button (used to disable during submission)
const serviceField = document.getElementById("service");         // Service dropdown field
const packageButtons = document.querySelectorAll(".request-package"); // All pricing buttons


/**
 * =========================================
 * PACKAGE SELECTION LOGIC
 * -----------------------------------------
 * When a user clicks a pricing button:
 * - Capture the selected package
 * - Auto-fill the service dropdown in the form
 * =========================================
 */
packageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const selectedPackage = button.dataset.package;

    if (serviceField && selectedPackage) {
      serviceField.value = selectedPackage;
    }
  });
});


/**
 * =========================================
 * STATUS MESSAGE HANDLER
 * -----------------------------------------
 * Updates the UI with feedback messages:
 * - Default message
 * - Success (green)
 * - Error (red)
 *
 * @param {string} message - Message to display
 * @param {string} type - Optional type ("success" or "error")
 * =========================================
 */
function setStatus(message, type = "") {
  formStatus.textContent = message;

  // Reset classes first
  formStatus.className = "form-status";

  // Apply status type styling if provided
  if (type) {
    formStatus.classList.add(type);
  }
}


/**
 * =========================================
 * FORM VALIDATION
 * -----------------------------------------
 * Ensures required fields are filled before
 * sending data to backend
 *
 * @param {Object} data - Form payload
 * @returns {string|null} Error message or null if valid
 * =========================================
 */
function validateForm(data) {
  if (!data.name.trim()) {
    return "Please enter your name.";
  }

  if (!data.email.trim()) {
    return "Please enter your email address.";
  }

  if (!data.website.trim()) {
    return "Please enter your website URL.";
  }

  if (!data.service.trim()) {
    return "Please select a service package.";
  }

  return null; // No validation errors
}


/**
 * =========================================
 * FORM SUBMISSION HANDLER
 * -----------------------------------------
 * Flow:
 * 1. Prevent default form submission
 * 2. Collect form data
 * 3. Validate input
 * 4. Send POST request to backend API
 * 5. Handle success or error response
 * =========================================
 */
if (contactForm) {
  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault(); // Prevent page reload

    /**
     * Collect form data and convert to plain object
     */
    const formData = new FormData(contactForm);
    const payload = {
      name: formData.get("name") || "",
      email: formData.get("email") || "",
      company: formData.get("company") || "",
      website: formData.get("website") || "",
      service: formData.get("service") || "",
      message: formData.get("message") || ""
    };

    /**
     * Validate input before sending to backend
     */
    const validationError = validateForm(payload);
    if (validationError) {
      setStatus(validationError, "error");
      return;
    }

    /**
     * Update UI to show submission is in progress
     */
    setStatus("Sending your request...");
    submitButton.disabled = true;

    try {
      /**
       * Send POST request to Vercel serverless function
       * Endpoint: /api/contact
       */
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      /**
       * Parse JSON response from backend
       */
      const result = await response.json();

      /**
       * Handle non-success HTTP responses
       */
      if (!response.ok) {
        throw new Error(result.error || "Something went wrong.");
      }

      /**
       * Success state:
       * - Show confirmation message
       * - Reset form fields
       */
      setStatus("Thank you. Your request was submitted successfully.", "success");
      contactForm.reset();

    } catch (error) {
      /**
       * Error state:
       * - Display error message to user
       */
      setStatus(error.message || "Unable to send your request right now.", "error");

    } finally {
      /**
       * Always re-enable submit button
       * (whether success or failure)
       */
      submitButton.disabled = false;
    }
  });
}