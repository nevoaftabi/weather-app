import concurrently from 'concurrently';

concurrently([
    {
        name: 'server',
        command: 'ts-node-dev --respawn src/index.ts',
        cwd: 'server',
        prefixColor: 'cyan'
    },
    {
        name: 'client',
        command: 'npm run dev',
        cwd: 'client',
        prefixColor: 'green'
    }
])