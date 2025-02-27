import axios from 'axios';
import config from '../../config.json';

const API_URL = process.env.NODE_ENV === 'production' 
  ? config.api.baseUrl.production
  : config.api.baseUrl.development;

// Create an axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// API functions for order operations
export const orderApi = {
  // Place a limit order
  placeLimitOrder: async (account, price, quantity, side, baseAsset, quoteAsset) => {
    try {
      const response = await api.post(config.api.endpoints.limitOrder, {
        account,
        price,
        quantity,
        side,
        baseAsset,
        quoteAsset
      });
      return response.data;
    } catch (error) {
      console.error('Error placing limit order:', error);
      throw error;
    }
  },
  
  // Cancel an order
  cancelOrder: async (orderId, side, baseAsset, quoteAsset) => {
    try {
      const response = await api.post(config.api.endpoints.cancelOrder, {
        orderId,
        side,
        baseAsset,
        quoteAsset
      });
      return response.data;
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  },
  
  // Get orderbook for a symbol
  getOrderBook: async (symbol) => {
    try {
      const formData = new FormData();
      formData.append('payload', JSON.stringify({ symbol }));
      
      const response = await api.post(config.api.endpoints.orderBook, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching orderbook:', error);
      throw error;
    }
  },

  // Initiate withdrawal (need to add this endpoint to the Execution Service)
  initiateWithdrawal: async (account, asset, amount) => {
    try {
      const response = await api.post(config.api.endpoints.initiateWithdrawal, {
        account,
        asset,
        amount
      });
      return response.data;
    } catch (error) {
      console.error('Error initiating withdrawal:', error);
      throw error;
    }
  }
};

export default api; 