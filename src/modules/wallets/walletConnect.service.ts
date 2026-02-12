import prisma from '../../lib/prisma';
import { AppError, ValidationError } from '../../utils/errors';

export class WalletConnectService {
  async connectWallet(userId: string, address: string, chain: string, signature: string) {
    const isValid = await this.verifySignature(address, signature, chain);
    if (!isValid) throw new ValidationError('Invalid wallet signature');

    // Check if any wallet for this user already has this deposit address
    const existingWallet = await prisma.wallet.findFirst({
      where: {
        userId,
        depositAddress: address.toLowerCase(),
      },
    });

    if (existingWallet) {
      throw new AppError('ALREADY_CONNECTED', 'Wallet already connected', 409);
    }

    // Store the connected wallet info as metadata on the user's wallets
    // Find the user's default wallet to store connection info
    const wallets = await prisma.wallet.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      take: 1,
    });

    if (wallets.length === 0) {
      throw new AppError('NO_WALLET', 'User has no wallets', 400);
    }

    // Update the wallet's deposit address with the connected external address
    await prisma.wallet.update({
      where: { id: wallets[0].id },
      data: { depositAddress: address.toLowerCase() },
    });

    return { address, chain, connected: true };
  }

  async disconnectWallet(userId: string, address: string, chain: string) {
    const wallet = await prisma.wallet.findFirst({
      where: {
        userId,
        depositAddress: address.toLowerCase(),
      },
    });

    if (!wallet) {
      throw new AppError('NOT_CONNECTED', 'Wallet is not connected', 404);
    }

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { depositAddress: null },
    });

    return { address, chain, disconnected: true };
  }

  async getConnectedWallets(userId: string) {
    const wallets = await prisma.wallet.findMany({
      where: {
        userId,
        depositAddress: { not: null },
      },
      include: { currency: true },
    });

    return wallets.map((w) => ({
      address: w.depositAddress,
      currency: w.currency.symbol,
      walletId: w.id,
    }));
  }

  async getNonce(address: string): Promise<string> {
    return `Sign this message to verify your wallet ownership.\nNonce: ${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private async verifySignature(address: string, signature: string, chain: string): Promise<boolean> {
    try {
      if (chain === 'EVM' || chain === 'ethereum' || chain === 'bsc' || chain === 'polygon') {
        const { ethers } = await import('ethers');
        const recoveredAddress = ethers.verifyMessage('wallet-connect-verification', signature);
        return recoveredAddress.toLowerCase() === address.toLowerCase();
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const walletConnectService = new WalletConnectService();
