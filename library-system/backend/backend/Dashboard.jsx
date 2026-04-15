import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from './api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const response = await api.get('books/');
        setBooks(response.data);
      } catch (err) {
        setError('Could not fetch books.');
        console.error('Book fetch error:', err);
      }
    };

    fetchBooks();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  return (
    <div style={{ padding: '20px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #eee', paddingBottom: '10px' }}>
        <h1>Library Dashboard</h1>
        <button onClick={handleLogout} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
      </header>

      <div className="content">
        <h3>Welcome to the Library System</h3>
        <p>Select an option to manage the library:</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px', marginTop: '20px' }}>
          <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', backgroundColor: '#f8f9fa' }}>Manage Books</div>
          <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', backgroundColor: '#f8f9fa' }}>Manage Members</div>
          <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', textAlign: 'center', cursor: 'pointer', backgroundColor: '#f8f9fa' }}>Issue Book</div>
        </div>

        <div className="book-list" style={{ marginTop: '40px' }}>
          <h3>Available Books</h3>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ddd' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Title</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>Author</th>
                <th style={{ padding: '12px', textAlign: 'left' }}>ISBN</th>
              </tr>
            </thead>
            <tbody>
              {books.length > 0 ? (
                books.map(book => (
                  <tr key={book.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '12px' }}>{book.title}</td>
                    <td style={{ padding: '12px' }}>{book.author}</td>
                    <td style={{ padding: '12px' }}>{book.isbn}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" style={{ padding: '12px', textAlign: 'center' }}>No books available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;