import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initializeConnector } from '@web3-react/core';
import { MetaMask } from '@web3-react/metamask';
import { ethers } from 'ethers';

// Contract ABI and addresses
import P2POrderBookABI from '../utils/P2POrderBookABI';
import config from '../../config.js';

// Network configuration - Polygon Amoy
const CHAIN_ID = config.network.chainId; // Polygon Amoy testnet
const P2P_ORDERBOOK_ADDRESS = config.contracts.P2P_ORDERBOOK_ADDRESS; // Replace with actual address

// Initialize connectors
export const [metaMask, metaMaskHooks] = initializeConnector((actions) => new MetaMask({ actions }));
const { useChainId, useAccounts, useIsActivating, useIsActive, useProvider } = metaMaskHooks;

// Create context
const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  const chainId = useChainId();
  const accounts = useAccounts();
  const isActivating = useIsActivating();
  const isActive = useIsActive();
  const provider = useProvider();
  const [account, setAccount] = useState(accounts ? accounts[0] : undefined);
  
  const [loading, setLoading] = useState(false);
  const [orderBookContract, setOrderBookContract] = useState(null);
  const [networkError, setNetworkError] = useState('');

  // Connect wallet
  const connectWallet = useCallback(async () => {
    try {
      setLoading(true);
      await metaMask.activate();
    } catch (error) {
      console.error('Error connecting wallet:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    try {
      metaMask.resetState();
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
    }
  }, []);

  // Try to connect to wallet on page load
  useEffect(() => {
    const connectWalletOnPageLoad = async () => {
      try {
        if (metaMask.connectEagerly) {
          await metaMask.connectEagerly();
        }
      } catch (error) {
        console.error('Error connecting eagerly:', error);
      } finally {
        setLoading(false);
      }
    };
    connectWalletOnPageLoad();
  }, []);

  // Initialize contracts when wallet is connected
  useEffect(() => {
    if (isActive && provider && account) {
      try {
        const signer = provider.getSigner();
        const newOrderBookContract = new ethers.Contract(
          P2P_ORDERBOOK_ADDRESS,
          P2POrderBookABI,
          signer
        );
        setOrderBookContract(newOrderBookContract);
        setNetworkError('');
      } catch (error) {
        console.error('Error initializing contracts:', error);
        setOrderBookContract(null);
      }
    } else {
      setOrderBookContract(null);
    }
  }, [isActive, provider, account]);

  // Check correct network
  useEffect(() => {
    if (isActive && chainId !== CHAIN_ID) {
      setNetworkError(`Please connect to Polygon Amoy (Chain ID: ${CHAIN_ID})`);
    } else {
      setNetworkError('');
    }
  }, [isActive, chainId]);

  // Escrow funds
  const escrowFunds = async (tokenAddress, amount) => {
    if (!orderBookContract || !isActive) return null;
    
    try {
      console.log("Escrowing token address:", tokenAddress);
      console.log("Escrowing token amount:", amount);

      // First approve the contract to spend tokens
      const signer = provider.getSigner();
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function approve(address spender, uint256 amount) public returns (bool)',
         'function decimals() public view returns (uint8)',
         'function balanceOf(address owner) public view returns (uint256)'],
        signer
      );
  
      console.log("Token contract:", tokenContract);

      const decimals = await tokenContract.decimals();
      const amountInWei = ethers.utils.parseUnits(amount.toString(), decimals);
      
      console.log("Amount in wei:", amountInWei);

      // Add balance check
      const balance = await tokenContract.balanceOf(account);
      console.log("Account balance:", ethers.utils.formatUnits(balance, decimals));
      console.log("Attempting to escrow:", amount);
      
      if (balance.lt(amountInWei)) {
        throw new Error('Insufficient balance');
      }

      // Add gas estimation with manual limit
      // const gasEstimate = await orderBookContract.estimateGas.escrow(
      //   tokenAddress, 
      //   amountInWei,
      //   { from: account }
      // );
      
      // console.log("Estimated gas:", gasEstimate.toString());

      const approveTx = await tokenContract.approve(P2P_ORDERBOOK_ADDRESS, amountInWei);
      await approveTx.wait();
      
      // Add gas limit buffer
      const tx = await orderBookContract.escrow(
        tokenAddress, 
        amountInWei,
        // { 
        //   gasLimit: gasEstimate.mul(120).div(100) // Add 20% buffer
        // }
      );
      const receipt = await tx.wait();
      return receipt;
    } catch (error) {
      console.error('Error in escrow transaction:', error);
      // Add more detailed error information
      if (error.data) {
        console.error('Error data:', error.data);
      }
      throw error;
    }
  };

  // Get escrow balance
  const getEscrowBalance = async (tokenAddress) => {
    if (!orderBookContract || !isActive) return null;

    try {
      const signer = provider.getSigner();
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function decimals() public view returns (uint8)',
         'function balanceOf(address owner) public view returns (uint256)'],
        signer
      );

      const escrowedFunds = await orderBookContract.escrowedFunds(account, tokenAddress);
      const decimals = await tokenContract.decimals();
      const formattedBalance = ethers.utils.formatUnits(escrowedFunds || '0', decimals);

      return formattedBalance;
    } catch (error) {
      console.error('Error fetching escrow balance:', error);
      throw error;
    }
  };
  

  // Update account state when accounts change
  useEffect(() => {
    setAccount(accounts ? accounts[0] : undefined);
  }, [accounts]);

  // Handle account changes from window.ethereum
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', async (accounts) => {
        if (accounts.length > 0) {
          const newAccount = accounts[0];
          setAccount(newAccount);
          // Reinitialize contracts with new account
          if (provider) {
            const signer = provider.getSigner();
            const newOrderBookContract = new ethers.Contract(
              P2P_ORDERBOOK_ADDRESS,
              P2POrderBookABI,
              signer
            );
            setOrderBookContract(newOrderBookContract);
          }
        } else {
          setAccount(undefined);
          setOrderBookContract(null);
          disconnectWallet();
        }
      });

      // Also listen for chain changes
      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', () => {});
        window.ethereum.removeListener('chainChanged', () => {});
      }
    };
  }, [provider, disconnectWallet]);

  return (
    <Web3Context.Provider
      value={{
        connectWallet,
        disconnectWallet,
        escrowFunds,
        getEscrowBalance,
        account,
        setAccount,
        active: isActive,
        provider,
        loading,
        orderBookContract,
        chainId,
        networkError,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

// Custom hook for using the Web3 context
export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
} 