import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, onAuthStateChanged, signOut, updateProfile, sendPasswordResetEmail } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, serverTimestamp, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

// --- Context for User and Firebase Instances Hello! 17:57 on 11 july ---
const AppContext = createContext();

// Custom Message Box Component
const MessageBox = ({ message, onClose }) => { 
    if (!message) return null;
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full text-center">
                <p className="text-gray-800 text-lg mb-4">{message}</p>
                <button
                    onClick={onClose}
                    className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition duration-300"
                >
                    OK
                </button>
            </div>
        </div>
    );
};

// --- Welcome Page Component ---
const WelcomePage = ({ navigate }) => {
    const [registerEmail, setRegisterEmail] = useState('');
    const [registerPassword, setRegisterPassword] = useState('');
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [showRegisterPassword, setShowRegisterPassword] = useState(false); // State for password visibility
    const [showLoginPassword, setShowLoginPassword] = useState(false); // State for password visibility

    const { auth, db, showMessageBox, appId } = useContext(AppContext);

    // Function to validate password policy
    const validatePassword = (password) => {
        if (password.length < 8) {
            return "Password must be minimum of 8 characters long.";
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return "Password must contain at least one special symbol.";
        }
        return null; // Password is valid
    };

    const handleRegister = async () => {
        if (!registerEmail || !registerPassword) {
            showMessageBox("Please enter both email and password for registration.");
            return;
        }

        const passwordError = validatePassword(registerPassword);
        if (passwordError) {
            showMessageBox(passwordError);
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, registerEmail, registerPassword);
            const user = userCredential.user;

            await sendEmailVerification(user);
            // After registration, sign out the user so they MUST verify email before logging in
            await auth.signOut();

            // Create a user document in Firestore minor addition for Push test
            await setDoc(doc(db, `artifacts/${appId}/users/${user.uid}`), {
                email: user.email,
                name: '', // Placeholder for user's name
                isAdmin: false, // Default to non-admin
                createdAt: serverTimestamp()
            });

            showMessageBox(`Registration successful! A verification email has been sent to ${user.email}. Please verify your email address before logging in.`);
            setRegisterEmail('');
            setRegisterPassword('');
        } catch (error) {
            console.error("Error during registration:", error);
            let errorMessage = "Registration failed.";
            if (error.code === 'auth/email-already-in-use') {
                errorMessage = "This email is already in use. Please try logging in or use a different email.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Invalid email address format.";
            } else if (error.code === 'auth/weak-password') {
                errorMessage = "Password is too weak. Please choose a stronger password.";
            }
            else {
                errorMessage = `Registration failed: ${error.message}`;
            }
            showMessageBox(errorMessage);
        }
    };

    const handleLogin = async () => {
        if (!loginEmail || !loginPassword) {
            showMessageBox("Please enter both email and password for login.");
            return;
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
            const user = userCredential.user;

            if (!user.emailVerified) {
                await auth.signOut(); // Sign out if email not verified
                showMessageBox("Your email address is not verified. Please check your inbox for a verification link.");
                return;
            }

            showMessageBox(`Login successful! Welcome back, ${user.email}!`);
            setLoginEmail('');
            setLoginPassword('');
            navigate('account'); // Redirect to account page after successful login
        } catch (error) {
            console.error("Error during login:", error);
            let errorMessage = "Login failed.";
            if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                errorMessage = "Invalid email or password.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Invalid email address format.";
            } else if (error.code === 'auth/user-disabled') {
                errorMessage = "This account has been disabled.";
            } else {
                errorMessage = `Login failed: ${error.message}`;
            }
            showMessageBox(errorMessage);
        }
    };

    const handleForgotPassword = async () => {
        if (!loginEmail) {
            showMessageBox("Please enter your email address in the Login section to reset your password.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, loginEmail);
            showMessageBox(`Password reset email sent to ${loginEmail}. Please check your inbox.`);
        } catch (error) {
            console.error("Error sending password reset email:", error);
            let errorMessage = "Failed to send password reset email.";
            if (error.code === 'auth/user-not-found') {
                errorMessage = "No user found with that email address.";
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = "Invalid email address format.";
            } else {
                errorMessage = `Failed to send password reset email: ${error.message}`;
            }
            showMessageBox(errorMessage);
        }
    };

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl flex flex-col items-center mb-8">
            <h1 className="text-4xl font-bold text-center text-gray-800 mb-8">Welcome to the GIGL Marketplace</h1>

            <div className="w-full flex flex-col md:flex-row gap-8">
                <div className="flex-1 p-6 border border-gray-200 rounded-lg shadow-sm">
                    <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Register</h2>
                    <div className="mb-4">
                        <label htmlFor="registerEmail" className="block text-gray-700 text-sm font-medium mb-2">Email:</label>
                        <input type="email" id="registerEmail" placeholder="your.email@example.com" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)}
                               className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="mb-6 relative">
                        <label htmlFor="registerPassword" className="block text-gray-700 text-sm font-medium mb-2">Password:</label>
                        <input type={showRegisterPassword ? "text" : "password"} id="registerPassword" placeholder="********" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)}
                               className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10" />
                        <button type="button" onClick={() => setShowRegisterPassword(!showRegisterPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 mt-7">
                            {showRegisterPassword ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    <button onClick={handleRegister} className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition duration-300 ease-in-out shadow-md">
                        Register
                    </button>
                </div>

                <div className="flex-1 p-6 border border-gray-200 rounded-lg shadow-sm">
                    <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Login</h2>
                    <div className="mb-4">
                        <label htmlFor="loginEmail" className="block text-gray-700 text-sm font-medium mb-2">Email:</label>
                        <input type="email" id="loginEmail" placeholder="your.email@example.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                               className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                    </div>
                    <div className="mb-6 relative">
                        <label htmlFor="loginPassword" className="block text-gray-700 text-sm font-medium mb-2">Password:</label>
                        <input type={showLoginPassword ? "text" : "password"} id="loginPassword" placeholder="********" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)}
                               className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 pr-10" />
                        <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 mt-7">
                            {showLoginPassword ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    <button onClick={handleLogin} className="w-full bg-green-600 text-white p-3 rounded-lg hover:bg-green-700 transition duration-300 ease-in-out shadow-md">
                        Login
                    </button>
                    <button type="button" onClick={handleForgotPassword}
                            className="mt-3 w-full text-blue-600 hover:underline text-sm text-center">
                        Forgotten password?
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Account Page Component ---
const AccountPage = ({ navigate }) => {
    const { currentUser, userDetails, updateUserDetails, bids, bidOpportunities, showMessageBox, auth } = useContext(AppContext);
    const [userName, setUserName] = useState(userDetails?.name || '');
    // Removed isEditing state and related buttons for direct input
    // const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        setUserName(userDetails?.name || '');
    }, [userDetails]);

    const handleUpdateProfile = async () => {
        if (!currentUser || !userDetails) {
            showMessageBox("User not logged in or profile not loaded.");
            return;
        }
        if (userName.trim() === '') {
            showMessageBox("Name cannot be empty.");
            return;
        }

        try {
            await updateProfile(currentUser, { displayName: userName.trim() });
            await updateUserDetails(currentUser.uid, { name: userName.trim() });
            showMessageBox("Profile updated successfully!");
            // setIsEditing(false); // No longer needed
        } catch (error) {
            console.error("Error updating profile:", error);
            showMessageBox(`Failed to update profile: ${error.message}`);
        }
    };

    const userBids = bids.filter(bid => bid.bidderId === currentUser?.uid);
    const otherOpportunities = bidOpportunities.filter(opp => {
        const hasBid = userBids.some(bid => bid.opportunityId === opp.id);
        const isClosed = opp.closingDate && new Date(opp.closingDate.toDate()) < new Date();
        return !hasBid && !isClosed;
    });

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-4xl flex flex-col items-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Your Account</h1>

            <div className="w-full mb-8 p-6 border border-gray-200 rounded-lg shadow-sm">
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Personal Details</h2>
                <div className="mb-4">
                    <p className="text-gray-600"><strong>Email:</strong> {currentUser?.email}</p>
                    <p className="text-gray-600 flex items-center">
                        <strong>Name:</strong>
                        <input
                            type="text"
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            onBlur={handleUpdateProfile} // Update on blur
                            className="ml-2 p-2 border border-gray-300 rounded-md flex-grow"
                        />
                        {/* Removed Edit/Save/Cancel buttons for direct input */}
                    </p>
                </div>
            </div>

            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="p-6 border border-gray-200 rounded-lg shadow-sm">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Bids You Have Made</h2>
                    {userBids.length > 0 ? (
                        <ul className="list-disc list-inside space-y-2">
                            {userBids.map(bid => (
                                <li key={bid.id} className="text-gray-700">
                                    Bid on "{bid.opportunityTitle}" for ${bid.bidAmount}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500">You haven't made any bids yet.</p>
                    )}
                    <button onClick={() => navigate('existingBids')}
                            className="mt-4 w-full bg-purple-600 text-white p-3 rounded-lg hover:bg-purple-700 transition duration-300 ease-in-out shadow-md">
                        View/Manage My Bids
                    </button>
                </div>

                <div className="p-6 border border-gray-200 rounded-lg shadow-sm">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Other Bid Opportunities</h2>
                    {otherOpportunities.length > 0 ? (
                        <ul className="list-disc list-inside space-y-2">
                            {otherOpportunities.map(opp => (
                                <li key={opp.id} className="text-gray-700">
                                    {opp.title} (Closes: {opp.closingDate ? new Date(opp.closingDate.toDate()).toLocaleString() : 'N/A'})
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-500">No new bid opportunities at the moment.</p>
                    )}
                    <button onClick={() => navigate('bidOpportunities')}
                            className="mt-4 w-full bg-teal-600 text-white p-3 rounded-lg hover:bg-teal-700 transition duration-300 ease-in-out shadow-md">
                        Explore Opportunities
                    </button>
                </div>
            </div>

            {userDetails?.isAdmin && (
                <div className="w-full p-6 border border-gray-200 rounded-lg shadow-sm bg-yellow-50">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Admin Panel</h2>
                    <p className="text-gray-600 mb-4">As an administrator, you have access to additional features.</p>
                    <button onClick={() => navigate('admin')}
                            className="w-full bg-red-600 text-white p-3 rounded-lg hover:bg-red-700 transition duration-300 ease-in-out shadow-md">
                        Go to Admin Dashboard
                    </button>
                </div>
            )}

            <button onClick={() => { signOut(auth); navigate('welcome'); }}
                    className="mt-8 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition duration-300 ease-in-out shadow-md">
                Logout
            </button>
        </div>
    );
};

// --- Existing Bids Page Component ---
const ExistingBidsPage = ({ navigate }) => {
    const { currentUser, bids, bidOpportunities, showMessageBox, db, appId } = useContext(AppContext);
    const userBids = bids.filter(bid => bid.bidderId === currentUser?.uid);

    const getOpportunityDetails = (opportunityId) => {
        return bidOpportunities.find(opp => opp.id === opportunityId);
    };

    const handleUpdateBid = async (bidId, currentBidAmount, opportunityId) => {
        const opportunity = getOpportunityDetails(opportunityId);
        if (!opportunity || (opportunity.closingDate && new Date(opportunity.closingDate.toDate()) < new Date())) {
            showMessageBox("Cannot update bid: The auction has already closed.");
            return;
        }

        const newBidAmount = parseFloat(prompt(`Enter new bid amount for "${opportunity.title}" (Current: $${currentBidAmount}):`));
        if (isNaN(newBidAmount) || newBidAmount <= currentBidAmount) {
            showMessageBox("Invalid bid amount. Please enter a number higher than your current bid.");
            return;
        }
        if (newBidAmount <= opportunity.currentHighestBid) {
             showMessageBox(`Your new bid must be higher than the current highest bid of $${opportunity.currentHighestBid}.`);
             return;
        }

        try {
            const bidRef = doc(db, `artifacts/${appId}/public/data/bids`, bidId);
            await updateDoc(bidRef, { bidAmount: newBidAmount, timestamp: serverTimestamp() });

            if (newBidAmount > opportunity.currentHighestBid) {
                const oppRef = doc(db, `artifacts/${appId}/public/data/bidOpportunities`, opportunityId);
                await updateDoc(oppRef, { currentHighestBid: newBidAmount, highestBidderId: currentUser.uid });
            }
            console.log(`Bid updated for ${opportunity.title} by ${currentUser.email}. Email notification to be sent by backend.`); // Email trigger acknowledgment
            showMessageBox("Bid updated successfully!");
        } catch (error) {
            console.error("Error updating bid:", error);
            showMessageBox(`Failed to update bid: ${error.message}`);
        }
    };

    const handleWithdrawBid = async (bidId, opportunityId) => {
        const opportunity = getOpportunityDetails(opportunityId);
        if (!opportunity || (opportunity.closingDate && new Date(opportunity.closingDate.toDate()) < new Date())) {
            showMessageBox("Cannot withdraw bid: The auction has already closed.");
            return;
        }

        const confirmWithdraw = window.confirm("Are you sure you want to withdraw this bid?");
        if (!confirmWithdraw) return;

        try {
            const bidRef = doc(db, `artifacts/${appId}/public/data/bids`, bidId);
            await deleteDoc(bidRef);

            console.log(`Bid withdrawn for ${opportunity.title} by ${currentUser.email}. Email notification to be sent by backend.`); // Email trigger acknowledgment
            showMessageBox("Bid withdrawn successfully!");
        } catch (error) {
            console.error("Error withdrawing bid:", error);
            showMessageBox(`Failed to withdraw bid: ${error.message}`);
        }
    };

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-4xl flex flex-col items-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Your Existing Bids</h1>

            {userBids.length === 0 ? (
                <p className="text-gray-500 text-lg">You have not placed any bids yet.</p>
            ) : (
                <div className="w-full space-y-4">
                    {userBids.map(bid => {
                        const opportunity = getOpportunityDetails(bid.opportunityId);
                        const isClosed = opportunity?.closingDate && new Date(opportunity.closingDate.toDate()) < new Date();
                        return (
                            <div key={bid.id} className="p-4 border border-gray-200 rounded-lg shadow-sm flex flex-col md:flex-row justify-between items-center">
                                <div>
                                    <p className="text-lg font-semibold text-gray-800">{opportunity?.title || 'Unknown Opportunity'}</p>
                                    <p className="text-gray-700">Your Bid: <span className="font-bold">${bid.bidAmount}</span></p>
                                    <p className="text-gray-600 text-sm">Placed on: {bid.timestamp ? new Date(bid.timestamp.toDate()).toLocaleString() : 'N/A'}</p>
                                    {opportunity && (
                                        <p className="text-gray-600 text-sm">Closes: {opportunity.closingDate ? new Date(opportunity.closingDate.toDate()).toLocaleString() : 'N/A'}</p>
                                    )}
                                </div>
                                <div className="mt-4 md:mt-0 flex gap-2">
                                    <button
                                        onClick={() => handleUpdateBid(bid.id, bid.bidAmount, bid.opportunityId)}
                                        disabled={isClosed}
                                        className={`px-4 py-2 rounded-md transition duration-300 ${isClosed ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                                    >
                                        {isClosed ? 'Closed' : 'Update Bid'}
                                    </button>
                                    <button
                                        onClick={() => handleWithdrawBid(bid.id, bid.opportunityId)}
                                        disabled={isClosed}
                                        className={`px-4 py-2 rounded-md transition duration-300 ${isClosed ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
                                    >
                                        Withdraw Bid
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <button onClick={() => navigate('account')}
                    className="mt-8 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition duration-300 ease-in-out shadow-md">
                Back to Account
            </button>
        </div>
    );
};

// --- Bid Opportunities Page Component ---
const BidOpportunitiesPage = ({ navigate }) => {
    const { currentUser, bidOpportunities, bids, showMessageBox, db, appId } = useContext(AppContext);

    const handlePlaceBid = async (opportunityId, currentHighestBid) => {
        if (!currentUser) {
            showMessageBox("You must be logged in to place a bid.");
            return;
        }

        const bidAmount = parseFloat(prompt("Enter your bid amount:"));
        if (isNaN(bidAmount) || bidAmount <= 0) {
            showMessageBox("Invalid bid amount. Please enter a positive number.");
            return;
        }
        if (bidAmount <= currentHighestBid) {
            showMessageBox(`Your bid must be higher than the current highest bid of $${currentHighestBid}.`);
            return;
        }

        const opportunity = bidOpportunities.find(opp => opp.id === opportunityId);
        if (!opportunity || (opportunity.closingDate && new Date(opportunity.closingDate.toDate()) < new Date())) {
            showMessageBox("Cannot place bid: The auction has already closed.");
            return;
        }

        try {
            await addDoc(collection(db, `artifacts/${appId}/public/data/bids`), {
                opportunityId: opportunityId,
                bidderId: currentUser.uid,
                bidAmount: bidAmount,
                timestamp: serverTimestamp(),
                opportunityTitle: opportunity.title
            });

            const oppRef = doc(db, `artifacts/${appId}/public/data/bidOpportunities`, opportunityId);
            await updateDoc(oppRef, {
                currentHighestBid: bidAmount,
                highestBidderId: currentUser.uid
            });
            console.log(`Bid placed for ${opportunity.title} by ${currentUser.email}. Email notification to be sent by backend.`); // Email trigger acknowledgment
            showMessageBox("Bid placed successfully!");
        } catch (error) {
            console.error("Error placing bid:", error);
            showMessageBox(`Failed to place bid: ${error.message}`);
        }
    };

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-4xl flex flex-col items-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Bid Opportunities</h1>

            {bidOpportunities.length === 0 ? (
                <p className="text-gray-500 text-lg">No bid opportunities available at the moment.</p>
            ) : (
                <div className="w-full space-y-4">
                    {bidOpportunities.map(opp => {
                        const isClosed = opp.closingDate && new Date(opp.closingDate.toDate()) < new Date();
                        const userHasBid = bids.some(bid => bid.opportunityId === opp.id && bid.bidderId === currentUser?.uid);
                        return (
                            <div key={opp.id} className="p-4 border border-gray-200 rounded-lg shadow-sm">
                                <h2 className="text-xl font-semibold text-gray-800 mb-2">{opp.title}</h2>
                                <p className="text-gray-700 mb-1">{opp.description}</p>
                                <p className="text-gray-600 text-sm mb-1">Current Highest Bid: <span className="font-bold">${opp.currentHighestBid || 0}</span></p>
                                <p className="text-gray-600 text-sm mb-3">Closes: {opp.closingDate ? new Date(opp.closingDate.toDate()).toLocaleString() : 'N/A'}</p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePlaceBid(opp.id, opp.currentHighestBid || 0)}
                                        disabled={isClosed}
                                        className={`px-4 py-2 rounded-md transition duration-300 ${isClosed ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                                    >
                                        {isClosed ? 'Closed' : (userHasBid ? 'Place Higher Bid' : 'Place Bid')}
                                    </button>
                                    {isClosed && <span className="text-red-500 font-medium">Auction Closed</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <button onClick={() => navigate('account')}
                    className="mt-8 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition duration-300 ease-in-out shadow-md">
                Back to Account
            </button>
        </div>
    );
};

// --- Admin Page Component ---
const AdminPage = ({ navigate }) => {
    const { userDetails, showMessageBox, db, appId } = useContext(AppContext);
    const [newOppTitle, setNewOppTitle] = useState('');
    const [newOppDesc, setNewOppDesc] = useState('');
    const [newOppClosingDate, setNewOppClosingDate] = useState('');

    if (!userDetails?.isAdmin) {
        return (
            <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-2xl text-center">
                <h1 className="text-3xl font-bold text-red-600 mb-4">Access Denied</h1>
                <p className="text-gray-700 mb-6">You do not have administrative privileges to view this page.</p>
                <button onClick={() => navigate('account')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 ease-in-out shadow-md">
                    Back to Account
                </button>
            </div>
        );
    }

    const handleAddOpportunity = async () => {
        if (!newOppTitle || !newOppDesc || !newOppClosingDate) {
            showMessageBox("Please fill in all fields for the new opportunity.");
            return;
        }

        const closingDate = new Date(newOppClosingDate);
        if (isNaN(closingDate.getTime()) || closingDate < new Date()) {
            showMessageBox("Invalid closing date. Please select a future date and time.");
            return;
        }

        try {
            await addDoc(collection(db, `artifacts/${appId}/public/data/bidOpportunities`), {
                title: newOppTitle,
                description: newOppDesc,
                closingDate: closingDate,
                currentHighestBid: 0,
                highestBidderId: null,
                createdAt: serverTimestamp()
            });
            showMessageBox("New bid opportunity added successfully!");
            setNewOppTitle('');
            setNewOppDesc('');
            setNewOppClosingDate('');
        } catch (error) {
            console.error("Error adding opportunity:", error);
            showMessageBox(`Failed to add opportunity: ${error.message}`);
        }
    };

    return (
        <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-4xl flex flex-col items-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-6">Admin Dashboard</h1>

            <div className="w-full mb-8 p-6 border border-gray-200 rounded-lg shadow-sm">
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Add New Bid Opportunity</h2>
                <div className="mb-4">
                    <label htmlFor="newOppTitle" className="block text-gray-700 text-sm font-medium mb-2">Title:</label>
                    <input type="text" id="newOppTitle" value={newOppTitle} onChange={(e) => setNewOppTitle(e.target.value)}
                           className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="mb-4">
                    <label htmlFor="newOppDesc" className="block text-gray-700 text-sm font-medium mb-2">Description:</label>
                    <textarea id="newOppDesc" value={newOppDesc} onChange={(e) => setNewOppDesc(e.target.value)} rows="3"
                              className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"></textarea>
                </div>
                <div className="mb-6">
                    <label htmlFor="newOppClosingDate" className="block text-gray-700 text-sm font-medium mb-2">Closing Date & Time:</label>
                    <input type="datetime-local" id="newOppClosingDate" value={newOppClosingDate} onChange={(e) => setNewOppClosingDate(e.target.value)}
                           className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <button onClick={handleAddOpportunity}
                        className="w-full bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition duration-300 ease-in-out shadow-md">
                    Add Opportunity
                </button>
            </div>

            <div className="w-full p-6 border border-gray-200 rounded-lg shadow-sm">
                <h2 className="text-2xl font-semibold text-gray-700 mb-4">Reports (Placeholder)</h2>
                <p className="text-gray-600">This section will contain various reports for bid opportunities and user activity.</p>
                <button className="mt-4 w-full bg-gray-400 text-white p-3 rounded-lg cursor-not-allowed">
                    Generate Reports (Coming Soon)
                </button>
            </div>

            <button onClick={() => navigate('account')}
                    className="mt-8 px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition duration-300 ease-in-out shadow-md">
                Back to Account
            </button>
        </div>
    );
};


// --- Firebase Configuration (Defined outside component for stability) ---
// These values will be read from environment variables.
// You MUST create a .env file in your project root with these variables.
// Example .env content:
// REACT_APP_FIREBASE_API_KEY="AIzaSyC..."
// REACT_APP_FIREBASE_AUTH_DOMAIN="your-project-id.firebaseapp.com"
// REACT_APP_FIREBASE_PROJECT_ID="your-project-id"
// REACT_APP_FIREBASE_STORAGE_BUCKET="your-project-id.appspot.com"
// REACT_APP_FIREBASE_MESSAGING_SENDER_ID="1234567890"
// REACT_APP_FIREBASE_APP_ID="1:1234567890:web:abcdef1234567890abcdef"
// REACT_APP_MY_APP_ID_FOR_FIRESTORE_PATHS="gigl-marketplace"
// REACT_APP_CONTACT_EMAIL="david@baxterenvironmental.co.uk"

const YOUR_FIREBASE_CONFIG = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  // measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID // Uncomment if you use Analytics
};

const MY_APP_ID_FOR_FIRESTORE_PATHS = process.env.REACT_APP_MY_APP_ID_FOR_FIRESTORE_PATHS || "gigl-marketplace";
const CONTACT_EMAIL = process.env.REACT_APP_CONTACT_EMAIL || "info@gigl.com"; // Default if not set in .env


// --- Main App Component ---
export default function App() {
    const [currentPage, setCurrentPage] = useState('welcome');
    const [currentUser, setCurrentUser] = useState(null);
    const [userDetails, setUserDetails] = useState(null);
    const [bids, setBids] = useState([]);
    const [bidOpportunities, setBidOpportunities] = useState([]);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [message, setMessage] = useState('');

    // Firebase instances stored in state
    const [firebaseAuth, setFirebaseAuth] = useState(null);
    const [firestoreDb, setFirestoreDb] = useState(null);


    const showMessageBox = (msg) => {
        setMessage(msg);
    };

    const closeMessageBox = () => {
        setMessage('');
    };

    const navigate = (page) => {
        setCurrentPage(page);
    };

    // Firebase Initialization and Auth State Listener
    useEffect(() => {
        // Check if essential config values are present
        if (!YOUR_FIREBASE_CONFIG.apiKey || !YOUR_FIREBASE_CONFIG.projectId) {
            showMessageBox("Firebase configuration is incomplete. Please ensure all REACT_APP_FIREBASE_... variables are set in your .env file.");
            console.error("Firebase configuration is missing or incomplete.");
            setIsAuthReady(true);
            return;
        }

        try {
            const appInstance = initializeApp(YOUR_FIREBASE_CONFIG);
            const authInstance = getAuth(appInstance);
            const dbInstance = getFirestore(appInstance);

            setFirebaseAuth(authInstance);
            setFirestoreDb(dbInstance);

            const unsubscribeAuth = onAuthStateChanged(authInstance, async (user) => {
                if (user) {
                    setCurrentUser(user);
                    const userDocRef = doc(dbInstance, `artifacts/${MY_APP_ID_FOR_FIRESTORE_PATHS}/users/${user.uid}`);
                    const userDocSnap = await getDoc(userDocRef);
                    if (userDocSnap.exists()) {
                        setUserDetails({ id: userDocSnap.id, ...userDocSnap.data() });
                    } else {
                        await setDoc(userDocRef, {
                            email: user.email,
                            name: user.displayName || '',
                            isAdmin: false,
                            createdAt: serverTimestamp()
                        });
                        const newUserDocSnap = await getDoc(userDocRef);
                        setUserDetails({ id: newUserDocSnap.id, ...newUserDocSnap.data() });
                    }
                    setCurrentPage('account');
                } else {
                    setCurrentUser(null);
                    setUserDetails(null);
                    setCurrentPage('welcome');
                }
                setIsAuthReady(true);
            });

            return () => unsubscribeAuth();
        } catch (error) {
            console.error("Error initializing Firebase:", error);
            showMessageBox(`Failed to initialize Firebase: ${error.message}`);
            setIsAuthReady(true);
        }
    }, []); // Empty dependency array as YOUR_FIREBASE_CONFIG is now stable outside

    useEffect(() => {
        if (!firestoreDb || !isAuthReady) return;

        // Corrected query for bidOpportunities: orderBy requires an index if not on a single field
        // For simplicity and to avoid index issues, we'll sort in memory if orderBy is not strict.
        // If you need server-side ordering, create an index in Firestore console.
        const opportunitiesQuery = collection(firestoreDb, `artifacts/${MY_APP_ID_FOR_FIRESTORE_PATHS}/public/data/bidOpportunities`);
        const unsubscribeOpportunities = onSnapshot(
            opportunitiesQuery,
            (snapshot) => {
                const opportunitiesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Client-side sort if needed and no Firestore index is present for orderBy
                opportunitiesData.sort((a, b) => (a.createdAt?.toDate() || 0) - (b.createdAt?.toDate() || 0));
                setBidOpportunities(opportunitiesData);
            },
            (error) => {
                console.error("Error fetching bid opportunities:", error);
                showMessageBox(`Error loading opportunities: ${error.message}`);
            }
        );

        const bidsQuery = collection(firestoreDb, `artifacts/${MY_APP_ID_FOR_FIRESTORE_PATHS}/public/data/bids`);
        const unsubscribeBids = onSnapshot(
            bidsQuery,
            (snapshot) => {
                const bidsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setBids(bidsData);
            },
            (error) => {
                console.error("Error fetching bids:", error);
                showMessageBox(`Error loading bids: ${error.message}`);
            }
        );

        return () => {
            unsubscribeOpportunities();
            unsubscribeBids();
        };
    }, [firestoreDb, isAuthReady]); // Removed MY_APP_ID_FOR_FIRESTORE_PATHS from dependency array

    const updateUserDetails = async (uid, data) => {
        if (!firestoreDb) return;
        try {
            await updateDoc(doc(firestoreDb, `artifacts/${MY_APP_ID_FOR_FIRESTORE_PATHS}/users/${uid}`), data);
            setUserDetails(prev => ({ ...prev, ...data }));
        } catch (error) {
            console.error("Error updating user details in Firestore:", error);
            showMessageBox(`Failed to update user details: ${error.message}`);
        }
    };


    const renderPage = () => {
        if (!isAuthReady) {
            return (
                <div className="min-h-screen flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
                    <p className="ml-4 text-gray-700">Loading application...</p>
                </div>
            );
        }

        return (
            <div className="min-h-screen flex flex-col items-center justify-between p-4 bg-f0f2f5 w-full">
                {/* Global Header with Logo */}
                <header className="w-full max-w-4xl bg-white p-4 rounded-xl shadow-lg mb-8 flex items-center justify-center">
                    {/* Ensure your logo file is in the public/ folder and the name matches exactly */}
                    <img src="/GIGL_Logo.png" alt="GIGL Marketplace Logo" className="h-[20vh] max-h-48 w-auto max-w-full rounded-md" /> {/* Larger and responsive */}
                </header>

                {/* Main Content Area */}
                <main className="flex-grow flex items-center justify-center w-full">
                    {(() => { // Using an IIFE for conditional rendering
                        switch (currentPage) {
                            case 'welcome':
                                return <WelcomePage navigate={navigate} />;
                            case 'account':
                                return <AccountPage navigate={navigate} />;
                            case 'existingBids':
                                return <ExistingBidsPage navigate={navigate} />;
                            case 'bidOpportunities':
                                return <BidOpportunitiesPage navigate={navigate} />;
                            case 'admin':
                                return <AdminPage navigate={navigate} />;
                            default:
                                return <WelcomePage navigate={navigate} />;
                        }
                    })()}
                </main>

                {/* Footer (remains outside main for consistent positioning) */}
                <footer className="w-full max-w-2xl text-center text-gray-600 text-sm mt-8 p-4">
                    <p className="mb-2">&copy; {new Date().getFullYear()} GIGL Limited. All rights reserved.</p>
                    <div className="flex justify-center space-x-4">
                        <button type="button" onClick={() => showMessageBox("Terms and Conditions link clicked. Replace this action with navigation to your actual URL.")} className="text-blue-600 hover:underline px-2 py-1 rounded-md">Terms and Conditions</button>
                        <span className="text-gray-400">|</span>
                        <button type="button" onClick={() => showMessageBox("Privacy Policy link clicked. Replace this action with navigation to your actual URL.")} className="text-blue-600 hover:underline px-2 py-1 rounded-md">Privacy Policy</button>
                        <span className="text-gray-400">|</span>
                        <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">Email</a>
                    </div>
                </footer>
            </div>
        );
    };

    return (
        <AppContext.Provider value={{ auth: firebaseAuth, db: firestoreDb, currentUser, userDetails, updateUserDetails, bids, bidOpportunities, showMessageBox, appId: MY_APP_ID_FOR_FIRESTORE_PATHS }}>
            {renderPage()}
            <MessageBox message={message} onClose={closeMessageBox} />
        </AppContext.Provider>
    );
}
