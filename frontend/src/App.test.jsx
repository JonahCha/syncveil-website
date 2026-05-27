import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from './App';
import { authAPI, isAuthenticated } from './api';

// 1. Mock the API layer to control success/error responses
jest.mock('./api', () => ({
  authAPI: {
    login: jest.fn(),
    signup: jest.fn(),
  },
  isAuthenticated: jest.fn(),
  getCurrentUser: jest.fn(),
}));

// 2. Mock child components to isolate App.jsx's state management
jest.mock('./components/Navigation', () => ({ onSwitchView }) => (
  <button data-testid="nav-auth" onClick={() => onSwitchView('auth-choice')}>
    Go to Auth
  </button>
));

jest.mock('./components/views/Home', () => () => <div data-testid="home">Home</div>);
jest.mock('./components/views/Dashboard', () => () => <div data-testid="dashboard">Dashboard</div>);
jest.mock('./components/views/InfoPage', () => () => <div data-testid="info">Info Page</div>);
jest.mock('./components/Footer', () => () => <footer data-testid="footer">Footer</footer>);

jest.mock('./components/views/AuthChoice', () => ({ onLogin, onSignup }) => (
  <div data-testid="auth-choice">
    <form data-testid="login-form" onSubmit={onLogin}>
      <input type="email" defaultValue="test@example.com" />
      <input type="password" defaultValue="password123" />
      <button type="submit">Submit Login</button>
    </form>
    <form data-testid="signup-form" onSubmit={onSignup}>
      <input type="email" defaultValue="test@example.com" />
      <input type="password" defaultValue="password123" />
      <button type="submit">Submit Signup</button>
    </form>
  </div>
));

describe('App.jsx Popup Rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure the app starts in an unauthenticated state
    isAuthenticated.mockReturnValue(false); 
  });

  test('renders error popup on login failure and allows user to dismiss it', async () => {
    // Arrange: Force login to throw an error
    const errorMessage = 'Invalid credentials provided.';
    authAPI.login.mockRejectedValue(new Error(errorMessage));

    render(<App />);

    // Act: Navigate to AuthChoice and submit the login form
    fireEvent.click(screen.getByTestId('nav-auth'));
    fireEvent.submit(screen.getByTestId('login-form'));

    // Assert: Verify the error popup is rendered
    const errorPopup = await screen.findByText(errorMessage);
    expect(errorPopup).toBeInTheDocument();
    
    // Act: Click the dismiss button
    const dismissButton = screen.getByText('Dismiss');
    fireEvent.click(dismissButton);

    // Assert: Verify the error popup is removed from the DOM
    expect(screen.queryByText(errorMessage)).not.toBeInTheDocument();
  });

  test('renders success popup on signup requiring verification and allows dismissal', async () => {
    // Arrange: Force signup to return a verification requirement
    authAPI.signup.mockResolvedValue({ requiresVerification: true });

    render(<App />);

    // Act: Navigate to AuthChoice and submit the signup form
    fireEvent.click(screen.getByTestId('nav-auth'));
    fireEvent.submit(screen.getByTestId('signup-form'));

    // Assert: Verify the success popup is rendered with the correct message
    const successMessage = 'Account created. Enter the verification code sent to your email.';
    const successPopup = await screen.findByText(successMessage);
    expect(successPopup).toBeInTheDocument();

    // Act: Click the dismiss button
    const dismissButton = screen.getByText('Dismiss');
    fireEvent.click(dismissButton);

    // Assert: Verify the success popup is removed from the DOM
    expect(screen.queryByText(successMessage)).not.toBeInTheDocument();
  });
});