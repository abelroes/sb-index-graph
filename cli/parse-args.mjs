export function parseArgs(argv) {
  const args = argv.slice(2);
  const cmd = args[0] && !args[0].startsWith('-') ? args[0] : undefined;
  let scope = 'global';
  let providers = null;
  let yes = false;
  let help = false;
  const flags = cmd ? args.slice(1) : args;
  for (const a of flags) {
    if (a === '-y' || a === '--yes') yes = true;
    else if (a === '-h' || a === '--help') help = true;
    else if (a.startsWith('--scope=')) scope = a.slice('--scope='.length);
    else if (a.startsWith('--providers=')) {
      providers = a.slice('--providers='.length).split(',').map((s) => s.trim()).filter(Boolean);
    }
  }
  return { cmd, scope, providers, yes, help };
}
