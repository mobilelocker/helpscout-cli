/**
 * helpscout auth <action>
 */
import { Command } from 'commander';
import { login, logout, status } from '../auth.js';

export function makeAuthCommand() {
  const cmd = new Command('auth');
  cmd.description('Manage Help Scout authentication');

  cmd
    .command('login')
    .description('Authenticate via OAuth (opens browser)')
    .action(async () => {
      const result = await login();
      process.stdout.write(result.message + '\n');
    });

  cmd
    .command('logout')
    .description('Remove cached credentials')
    .action(async () => {
      const result = await logout();
      process.stdout.write(result.message + '\n');
    });

  cmd
    .command('status')
    .description('Show authentication status')
    .action(async () => {
      const result = await status();
      process.stdout.write(result.message + '\n');
    });

  return cmd;
}
