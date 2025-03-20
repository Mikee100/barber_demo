


 document.addEventListener("DOMContentLoaded", function() {
    const dateInput = document.getElementById("date");

    


    dateInput.addEventListener("change", async () => {
        const selectedDate = dateInput.value;
    
        if (!selectedDate) return;
    
        try {
            // Fetch booked times for the selected date
            const response = await fetch(`http://localhost:5000/api/bookings/${selectedDate}`);
            const { bookedTimes } = await response.json();
    
            // Disable booked time slots in the UI
            const timeSlots = document.querySelectorAll(".time-slot");
            timeSlots.forEach(slot => {
                if (bookedTimes.includes(slot.textContent)) {
                    slot.classList.add("booked");
                    slot.style.pointerEvents = "none";
                    slot.style.opacity = "0.5";
                } else {
                    slot.classList.remove("booked");
                    slot.style.pointerEvents = "auto";
                    slot.style.opacity = "1";
                }
            });
        } catch (error) {
            console.error("Error fetching booked times:", error);
        }
    });
   
    const stripe = Stripe('pk_test_51P1B7LCXIhVW50LesYpPi6AtOMCuxUu6vIOa9rXOiHshVmgIOR9MRTrS8QgvwOL1Q7W409Y0BwVkwZNwkOwGyKxt00htQVUS9I'); // Replace with your actual public key
    const elements = stripe.elements();
    const cardElement = elements.create('card', {
        hidePostalCode: true, // Disable postal code requirement
        style: {
            base: {
                fontSize: '16px',
                color: '#32325d',
            },
        },
    });
    cardElement.mount('#cardElement');

    // Payment method selection
    const mpesaRadio = document.getElementById("mpesa");
    const stripeRadio = document.getElementById("stripe");
    const mpesaField = document.getElementById("mpesaField");
    const stripeField = document.getElementById("stripeField");

    function togglePaymentFields() {
        if (mpesaRadio.checked) {
            mpesaField.style.display = "block";
            stripeField.style.display = "none";
            document.getElementById("phoneNumber").required = true;
        } else {
            mpesaField.style.display = "none";
            stripeField.style.display = "block";
            document.getElementById("phoneNumber").required = false;
        }
    }

    mpesaRadio.addEventListener("change", togglePaymentFields);
    stripeRadio.addEventListener("change", togglePaymentFields);
    togglePaymentFields(); // Run on page load
    
    // Rest of your existing code...
    // Services Data
    const services = [
        { id: 1, name: 'Classic Cut', price: 100, duration: 30 },
        { id: 2, name: 'Beard Trim', price: 200, duration: 20 },
        { id: 3, name: 'Royal Treatment', price: 300, duration: 60 }
    ];

    // DOM Elements
    const serviceContainer = document.getElementById("serviceContainer");
    const serviceSelect = document.getElementById("service");
    const timeSlots = document.getElementById("timeSlots");
    const bookingForm = document.getElementById("bookingForm");
    const modal = document.getElementById("confirmationModal");
    const closeModal = document.querySelector(".close");
    const styleUpload = document.getElementById("styleUpload");
    const imagePreview = document.getElementById("imagePreview");

    if (!serviceContainer || !serviceSelect || !timeSlots || !bookingForm) {
        console.error("Missing elements in the DOM. Ensure all IDs exist.");
        return;
    }

    // Initialize Services
    services.forEach(service => {
        const card = document.createElement("div");
        card.className = "service-card";
        card.innerHTML = `
            <h3>${service.name}</h3>
            <p>KES ${service.price}</p>
            <small>${service.duration} mins</small>
        `;
        serviceContainer.appendChild(card);

        // Service Dropdown
        const option = document.createElement("option");
        option.value = service.id;
        option.textContent = `${service.name} (KES ${service.price})`;
        serviceSelect.appendChild(option);
    });

    // Generate Time Slots
    function generateTimeSlots() {
        const slots = [];
        const start = 9; // 9 AM
        const end = 18; // 6 PM
        for (let hour = start; hour < end; hour++) {
            slots.push(`${hour}:00`, `${hour}:30`);
        }
        return slots;
    }

    generateTimeSlots().forEach(time => {
        const slot = document.createElement("div");
        slot.className = "time-slot";
        slot.textContent = time;
        slot.addEventListener("click", () => {
            document.querySelectorAll(".time-slot").forEach(s => s.classList.remove("selected"));
            slot.classList.add("selected");
        });
        timeSlots.appendChild(slot);
    });

    // Handle Image Upload
    if (styleUpload) {
        styleUpload.addEventListener("change", function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    imagePreview.innerHTML = `
                        <div class="preview-header">
                            <span>Selected Style:</span>
                            <button onclick="clearImage()" class="clear-button">&times;</button>
                        </div>
                        <img src="${e.target.result}" class="preview-image" alt="Selected Style">
                    `;
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Clear Image
    window.clearImage = () => {
        imagePreview.innerHTML = "";
        styleUpload.value = "";
    };
 // Modal Handling
 closeModal.addEventListener("click", () => {
    modal.style.display = "none";
});
bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Show loading overlay
    showLoading();

    try {
        // Get form data
        const service = serviceSelect.value;
        const serviceName = serviceSelect.options[serviceSelect.selectedIndex].text.split(" (")[0];
        const price = services.find(s => s.id == service)?.price;
        const date = document.getElementById("date").value;
        const timeSlot = document.querySelector(".time-slot.selected");
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
        const styleImage = styleUpload.files[0];
        const time = timeSlot?.textContent;

        // Validate required fields
        if (!service || !date || !timeSlot || !paymentMethod) {
            hideLoading();
            alert("Please fill out all required fields.");
            return;
        }

        let transactionId = null;
        let phone = null;

        // Handle M-Pesa payment
        if (paymentMethod === "mpesa") {
            phone = document.getElementById("phoneNumber").value;
            if (!phone) {
                hideLoading();
                alert("Please enter your M-Pesa phone number.");
                return;
            }

            const paymentResult = await handleMpesaPayment(phone, price);
            console.log("M-Pesa API Response:", paymentResult);

            if (!paymentResult || !paymentResult.transactionId) {
                hideLoading();
                alert("M-Pesa payment failed or transaction ID not received.");
                return;
            }
            transactionId = paymentResult.transactionId;
        }
        // Handle Stripe payment
        else {
            const paymentResult = await handleStripePayment(price * 100); // Convert to cents
            if (!paymentResult || !paymentResult.transactionId) {
                hideLoading();
                alert("Stripe payment failed or transaction ID not received.");
                return;
            }
            transactionId = paymentResult.transactionId;
        }

        // Prepare form data for booking
        const formData = new FormData();
        formData.append("service_id", service);
        formData.append("service_name", serviceName);
        formData.append("price", price);
        formData.append("date", date);
        formData.append("time", time);
        formData.append("duration", services.find(s => s.id == service)?.duration);
        formData.append("payment_method", paymentMethod);
        if (styleImage) formData.append("style_image", styleImage);

        if (paymentMethod === "mpesa") {
            formData.append("phone", phone);
            formData.append("mpesa_transaction_id", transactionId);
        }

        // Send booking data to the backend
        const bookingResponse = await fetch("http://localhost:5000/api/bookings", {
            method: "POST",
            body: formData,
        });

        if (!bookingResponse.ok) {
            const bookingData = await bookingResponse.json();
            hideLoading();
            alert("Booking failed: " + (bookingData.error || "Unknown error"));
            return;
        }

        // Hide loading overlay and show success modal
        hideLoading();
        showSuccessModal();

        // Reset the form
        bookingForm.reset();
        clearImage();
        document.querySelectorAll(".time-slot").forEach(s => s.classList.remove("selected"));
    } catch (error) {
        hideLoading();
        console.error("Error:", error);
        alert("An error occurred during payment: " + error.message);
    }
});

// Loading Overlay Functions
function showLoading() {
    const loadingOverlay = document.getElementById("loadingOverlay");
    loadingOverlay.style.display = "flex";
}

function hideLoading() {
    const loadingOverlay = document.getElementById("loadingOverlay");
    loadingOverlay.style.display = "none";
}

// Success Modal Functions
function showSuccessModal() {
    const successModal = document.getElementById("successModal");
    successModal.style.display = "flex";
}

function closeSuccessModal() {
    const successModal = document.getElementById("successModal");
    successModal.style.display = "none";
}
    async function handleStripePayment(amount) {
        const { paymentMethod, error } = await stripe.createPaymentMethod({
            type: 'card',
            card: cardElement,
        });

        if (error) {
            throw new Error(error.message);
        }

        const response = await fetch("http://localhost:5000/api/stripe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amount: amount,
                paymentMethodId: paymentMethod.id,
            }),
        });

        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        return result;
    }

    async function handleMpesaPayment(phone, amount) {
        const response = await fetch("http://localhost:5000/api/mpesa/pay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, amount }),
        });
    
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
    
        // Ensure the CheckoutRequestID is returned as transactionId
        if (!result.CheckoutRequestID) {
            throw new Error("CheckoutRequestID not received from M-Pesa API.");
        }
    
        return {
            success: true,
            transactionId: result.CheckoutRequestID, // Use CheckoutRequestID as transactionId
        };
    }
    const handleMpesaCallbackPayment = async (phone, price) => {
        try {
            const paymentData = { phone, amount: price };
            const response = await axios.post("http://localhost:5000/api/mpesa/callback", paymentData);
    
            console.log("M-Pesa Response:", response.data); // Log the response
            
            if (!response.data || !response.data.transactionId) {
                alert("M-Pesa payment failed or transaction ID not received.");
                return null;
            }
    
            alert(`Payment successful! Transaction ID: ${response.data.transactionId}`);
            return response.data; // Ensure it returns the transactionId
        } catch (error) {
            console.error("Error processing M-Pesa payment:", error);
            alert("Payment failed. Please try again.");
            return null;
        }
        
    };
 
    
});

{/*}
import { db } from "./firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { addDoc, collection } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { collection, getDocs } from "firebase/firestore";

const functions = require("firebase-functions");
const axios = require("axios");

dateInput.addEventListener("change", async () => {
    const selectedDate = dateInput.value;

    if (!selectedDate) return;

    try {
        // Query Firestore for bookings on the selected date
        const bookingsRef = collection(db, "bookings");
        const q = query(bookingsRef, where("date", "==", selectedDate));
        const querySnapshot = await getDocs(q);

        const bookedTimes = [];
        querySnapshot.forEach((doc) => {
            bookedTimes.push(doc.data().time);
        });

        // Disable booked time slots in the UI
        const timeSlots = document.querySelectorAll(".time-slot");
        timeSlots.forEach(slot => {
            if (bookedTimes.includes(slot.textContent)) {
                slot.classList.add("booked");
                slot.style.pointerEvents = "none";
                slot.style.opacity = "0.5";
            } else {
                slot.classList.remove("booked");
                slot.style.pointerEvents = "auto";
                slot.style.opacity = "1";
            }
        });
    } catch (error) {
        console.error("Error fetching booked times:", error);
    }
});


bookingForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Show loading overlay
    showLoading();

    try {
        // Get form data
        const service = serviceSelect.value;
        const serviceName = serviceSelect.options[serviceSelect.selectedIndex].text.split(" (")[0];
        const price = services.find(s => s.id == service)?.price;
        const date = document.getElementById("date").value;
        const timeSlot = document.querySelector(".time-slot.selected");
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
        const styleImage = styleUpload.files[0];
        const time = timeSlot?.textContent;

        // Validate required fields
        if (!service || !date || !timeSlot || !paymentMethod) {
            hideLoading();
            alert("Please fill out all required fields.");
            return;
        }

        let transactionId = null;
        let phone = null;

        // Handle M-Pesa payment
        if (paymentMethod === "mpesa") {
            phone = document.getElementById("phoneNumber").value;
            if (!phone) {
                hideLoading();
                alert("Please enter your M-Pesa phone number.");
                return;
            }

            const paymentResult = await handleMpesaPayment(phone, price);
            console.log("M-Pesa API Response:", paymentResult);

            if (!paymentResult || !paymentResult.transactionId) {
                hideLoading();
                alert("M-Pesa payment failed or transaction ID not received.");
                return;
            }
            transactionId = paymentResult.transactionId;
        }
        // Handle Stripe payment
        else {
            const paymentResult = await handleStripePayment(price * 100); // Convert to cents
            if (!paymentResult || !paymentResult.transactionId) {
                hideLoading();
                alert("Stripe payment failed or transaction ID not received.");
                return;
            }
            transactionId = paymentResult.transactionId;
        }

        // Upload style image to Firebase Storage
        let styleImageUrl = null;
        if (styleImage) {
            const storageRef = ref(storage, `styles/${Date.now()}_${styleImage.name}`);
            await uploadBytes(storageRef, styleImage);
            styleImageUrl = await getDownloadURL(storageRef);
        }

        // Save booking to Firestore
        const bookingsRef = collection(db, "bookings");
        await addDoc(bookingsRef, {
            serviceId: service,
            serviceName,
            price,
            date,
            time,
            phone,
            mpesaTransactionId: transactionId,
            styleImageUrl,
            paymentMethod,
            createdAt: new Date().toISOString(),
        });

        // Hide loading overlay and show success modal
        hideLoading();
        showSuccessModal();

        // Reset the form
        bookingForm.reset();
        clearImage();
        document.querySelectorAll(".time-slot").forEach(s => s.classList.remove("selected"));
    } catch (error) {
        hideLoading();
        console.error("Error:", error);
        alert("An error occurred during payment: " + error.message);
    }
});


async function fetchServices() {
    const servicesRef = collection(db, "services");
    const querySnapshot = await getDocs(servicesRef);

    const services = [];
    querySnapshot.forEach((doc) => {
        services.push({ id: doc.id, ...doc.data() });
    });

    return services;
}

// Initialize Services
fetchServices().then(services => {
    services.forEach(service => {
        const card = document.createElement("div");
        card.className = "service-card";
        card.innerHTML = `
            <h3>${service.name}</h3>
            <p>KES ${service.price}</p>
            <small>${service.duration} mins</small>
        `;
        serviceContainer.appendChild(card);

        // Service Dropdown
        const option = document.createElement("option");
        option.value = service.id;
        option.textContent = `${service.name} (KES ${service.price})`;
        serviceSelect.appendChild(option);
    });
});

exports.handleMpesaPayment = functions.https.onCall(async (data, context) => {
    const { phone, amount } = data;

    // Call M-Pesa API
    const response = await axios.post("https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest", {
        // M-Pesa request payload
    });

    return { transactionId: response.data.CheckoutRequestID };
});*/}