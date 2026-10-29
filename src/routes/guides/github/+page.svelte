<script>
  import { tick } from 'svelte';
  import { afterNavigate } from '$app/navigation';
  import { page } from '$app/state';
  import BottomGlow from '$lib/components/BottomGlow.svelte';
  import Footer from '$lib/components/sections/Footer.svelte';
  import { jiggle } from '$lib/actions/jiggle.js';
  import { rainbowUnderline } from '$lib/actions/rainbowUnderline.js';
  import GitHubCommand from '$lib/components/GitHubCommand.svelte';
  import { parseGitHubRepository } from '$lib/guides/github.js';

  const aptGitHubSetup = `sudo apt update && sudo apt install curl ca-certificates
sudo mkdir -p -m 755 /etc/apt/keyrings
keyring=$(mktemp) && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o "$keyring" && sudo install -m 644 "$keyring" /etc/apt/keyrings/githubcli-archive-keyring.gpg
sudo mkdir -p -m 755 /etc/apt/sources.list.d
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh`;

  let github = $state('');
  let local = $state(false);
  let expanded = $state({ windows: false, macos: false, linux: false });
  const repository = $derived(parseGitHubRepository(github));

  afterNavigate(async () => {
    github = page.url.searchParams.get('github') ?? '';
    local = page.url.searchParams.get('local') === 'true';
    const platform = page.url.hash.slice(1);
    if (Object.hasOwn(expanded, platform)) {
      expanded[platform] = true;
      await tick();
      document.getElementById(platform)?.scrollIntoView();
    }
  });
</script>

<svelte:head>
  <title>github guide - jame gam</title>
</svelte:head>

<BottomGlow />

<main class="guide">
  <a class="back" href="/">back to jame gam</a>
  <h1 class="txt">
    <span style="display: inline-block" use:rainbowUnderline>
      <span use:jiggle={{ rainbow: true }}>github guide!</span>
    </span>
  </h1>

  <section id="about-git" aria-labelledby="about-git-title">
    <h2 id="about-git-title">what is git?</h2>
    <p>git is a tool for storing and tracking your code. git was invented by linus torvalds (the maker of Linux) when BitKeeper—the software the kernel had been using for 3 years—<abbr title="they didn't just randomly take it away, they did it because a prominent contributor to linux reverse engineered their proprietry protocols and made an open source client. ">decided to stop giving it to them for free</abbr>. he then began work on his own source control, and in only 10 days managed to make a functional program.</p>
  </section>
  <section id="key-terms" aria-labelledby="key-terms-title">
      <h2 id="key-terms-title">how does it work and how do i use it?</h2>
      <p>git is primarily a version control software. to save a version, you make a commit. a commit is a complete snapshot of the tracked folder and files at a particular moment. committing regularly is a good idea because that way you have lots of saved places in case you want to undo your changes! each commit gets given a unique identifier called a hash. it also gets a commit message, where you put a short description of what you changed. <br>git also has these things called branches. a branch is like a path, where your commits are points on the path. this lets you make different changes and base them off of certain points in time. git has a marker called the HEAD. this is where your current files are at. you can move this around by 'checking out' a commit, which changes the contents to what it was at that point in time.</p>
      <img
        src="https://res.cloudinary.com/hy4kyit2a/f_auto/fl_lossy/q_70/learn/modules/git-and-git-hub-basics/work-with-your-history-in-git/images/5a6db7e71b4710237f3bec217916c025_kix.6xyz74d74zp2.jpg"
        alt="Git history diagram"
      />
  </section>
  <section id="what-about-github" aria-labelledby="what-about-github-title">
      <h2 id="what-about-github-title">but wait, what about GitHub?</h2>
      <p>GitHub is a git server that is hosted by microsoft. git has this neat feature where you can 'push' your changes to a server, and 'pull' new ones when other people make things. GitHub is useful because it's a free way to host and back up your code! but it's not the only option, there's also other ones like Codeberg, GitLab, and self-hostable ones like Gitea and Forgejo. however, this guide is focused on GitHub.</p>
  </section>
  {#if !repository}
    <form method="GET" class="repository">
      <input type="hidden" name="local" value={local ? 'true' : 'false'} />
      <label for="github">enter your github repository here for it to be prefilled into the commands!</label>
      <div class="repository-input">
        <input id="github" name="github" value={github} placeholder="username/repo" spellcheck="false" autocapitalize="none" required />
        <button type="submit">use repository</button>
      </div>
      {#if github}
        <p class="error">enter a repository as username/repo.</p>
      {/if}
    </form>
  {/if}

  <nav aria-label="Operating systems">
    <a href="#windows" onclick={() => expanded.windows = true}>i use windows</a>
    <a href="#macos" onclick={() => expanded.macos = true}>i use macos</a>
    <a href="#linux" onclick={() => expanded.linux = true}>i use linux</a>
  </nav>

  <details class="platform" id="windows" bind:open={expanded.windows}>
    <summary><h2 id="windows-title">windows</h2></summary>
    <p>these steps turn your existing project folder into a git repository. your next commit keeps github's previous history
      and updates the repository to match the files in this folder.</p>

    <ol>
      <li>open command prompt: press <kbd>Win</kbd> + <kbd>R</kbd>, type <code>cmd</code>, and press <kbd>Enter</kbd>.</li>
      {#if !local}
        <li>
          install git:
          <GitHubCommand template="winget install --id Git.Git --exact" />
        </li>
      {/if}
      <li>
        install the github cli if you don't already have it:
        <GitHubCommand template="winget install --id GitHub.cli --exact" />
        close command prompt, then open it again so it can find the installed commands.
      </li>
      <li>
        log in to github:
        <GitHubCommand template="gh auth login" />
        choose <strong>GitHub.com</strong>, <strong>HTTPS</strong>, and <strong>Login with a web browser</strong>.
        follow the instructions to finish logging in, then run:
        <GitHubCommand template="gh auth setup-git" />
      </li>
      <li>
        in file explorer, find your <strong>actual project folder</strong>, with all its scenes, scripts, art, and audio.
        for godot, choose the folder containing <code>project.godot</code>.
        select that folder and press <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>C</kbd> to copy its path.
      </li>
      <li>
        in command prompt, type <code>cd /d </code> (with a space at the end), paste the copied path, and press <kbd>Enter</kbd>.
        keep the quotation marks around the path if it contains spaces.
      </li>
      <li>
        turn this folder into a git repository:
        <GitHubCommand template="git init -b main" />
        this guide is for a folder without existing git history. if git says it reinitialized an existing repository, stop here and ask in the help channel.
      </li>
      <li>
        connect it to your github repository:
        {#if repository}
          <GitHubCommand template={'git remote add origin {url}'} {repository} />
        {:else}
          <p>enter your github repository above to get your connection command.</p>
        {/if}
      </li>
      <li>
        check the branch name on github. the commands below use <code>main</code>; if your default branch has another name,
        replace <code>main</code> in both commands with that name.
        <GitHubCommand template="git branch -M main" />
        download that branch's history:
        <GitHubCommand template="git fetch origin main" />
        if the github repository is completely empty, there is no branch to fetch yet. skip the next step and continue to staging your files.
        for any other fetch error, fix it before continuing.
      </li>
      <li>
        use the downloaded history as the starting point, while keeping your local project files exactly as they are:
        <GitHubCommand template="git reset --mixed FETCH_HEAD" />
        use <code>--mixed</code> exactly as shown. this command does not download or replace your project files.
        files present on github but missing from this folder will appear as deletions in your next commit.
        put any README or license you want to keep into this folder before continuing.
      </li>
      <li>
        open the project in this folder in your editor and check that it works. then, back in command prompt, stage the files and check the list:
        <GitHubCommand template="git add --all" />
        <GitHubCommand template="git status" />
        check that your scenes, scripts, art, and audio are included. deleted files are included too, so the commit reflects this folder's current contents.
        ignored files won't be uploaded; if something you need is missing, check <code>.gitignore</code> before continuing.
      </li>
      <li>
        commit the project:
        <GitHubCommand template={'git commit -m "add the full project"'} />
        if git asks who you are, set your name and github email, then run the commit command again:
        <GitHubCommand template={'git config user.name "Your Name"'} />
        <GitHubCommand template={'git config user.email "your-github-email@example.com"'} />
        you can use your github no-reply email from <a href="https://github.com/settings/emails">github's email settings</a>.
      </li>
      <li>
        upload the commit:
        <GitHubCommand template="git push -u origin HEAD" />
        if git rejects the push because github has newer commits, stop and check with your reviewer rather than using force push.
        {#if repository}
          refresh <a href={'https://github.com/' + repository.github}>your repository on github</a> and check that the full project is there.
        {:else}
          refresh your repository on github and check that the full project is there.
        {/if}
      </li>
    </ol>
  </details>

  <details class="platform" id="macos" bind:open={expanded.macos}>
    <summary><h2 id="macos-title">macos</h2></summary>
    <ol>
      <li>
        press <kbd>Cmd</kbd> + <kbd>Space</kbd>, type <strong>Terminal</strong>, and press <kbd>Enter</kbd>.
      </li>
      {#if !local}
        <li>
          for macos, you're going to need the xcode command line developer tools. however, macos is smart!
          once you're in terminal, type:
          <GitHubCommand template="git --version" />
          if the tools aren't installed yet, you'll see a little popup prompting you to install them.
          <img
            src="https://i.sstatic.net/T2rkg.png"
            alt="macOS prompt to install the command line developer tools, with Cancel and Install buttons"
          />
          hit the one that says <strong>Install</strong> and wait for it to finish.
          if you see a git version instead, git is already installed and you can continue.
        </li>
      {/if}
      <li>
        still in terminal, run this to install homebrew, a macos package manager, if you don't already have it:
        <GitHubCommand template={'/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'} />
        once it finishes, follow the <strong>Next steps</strong> printed by the installer, including the commands to add homebrew to your PATH.
      </li>
      <li>
        install the github cli and wait for it to finish:
        <GitHubCommand template="brew install gh" />
      </li>
      <li>
        next, log in to github:
        <GitHubCommand template="gh auth login" />
        choose <strong>GitHub.com</strong>, <strong>HTTPS</strong>, and <strong>Login with a web browser</strong>.
        follow the instructions to finish logging in, then run:
        <GitHubCommand template="gh auth setup-git" />
      </li>
      <li>
        in terminal, type <code>cd</code> followed by a space, then drag your actual project folder onto terminal. then press <kbd>Enter</kbd>!
        <img
          src="/guides/macos-open-project-folder.gif"
          alt="Typing cd followed by a space in Terminal, dragging a project folder into the window, and pressing Enter."
          width="1200"
          height="501"
          loading="lazy"
        />
        for godot, choose the folder containing <code>project.godot</code>.
      </li>
      <li>
        turn this folder into a git repository:
        <GitHubCommand template="git init -b main" />
        this guide is for a folder without existing git history. if git says it reinitialized an existing repository, stop here and ask in the help channel.
      </li>
      <li>
        connect it to your github repository:
        {#if repository}
          <GitHubCommand template={'git remote add origin {url}'} {repository} />
        {:else}
          <p>enter your github repository above to get your connection command.</p>
        {/if}
      </li>
      <li>
        check the branch name on github. the commands below use <code>main</code>; if your default branch has another name,
        replace <code>main</code> in both commands with that name.
        <GitHubCommand template="git branch -M main" />
        download that branch's history:
        <GitHubCommand template="git fetch origin main" />
        if the github repository is completely empty, there is no branch to fetch yet. skip the next step and continue to staging your files.
        for any other fetch error, fix it before continuing.
      </li>
      <li>
        use the downloaded history as the starting point, while keeping your local project files exactly as they are:
        <GitHubCommand template="git reset --mixed FETCH_HEAD" />
        use <code>--mixed</code> exactly as shown. this command does not download or replace your project files.
        files present on github but missing from this folder will appear as deletions in your next commit.
        put any README or license you want to keep into this folder before continuing.
      </li>
      <li>
        open the project in this folder in your editor and check that it works. then, back in terminal, stage the files and check the list:
        <GitHubCommand template="git add --all" />
        <GitHubCommand template="git status" />
        check that your scenes, scripts, art, and audio are included. deleted files are included too, so the commit reflects this folder's current contents.
        ignored files won't be uploaded; if something you need is missing, check <code>.gitignore</code> before continuing.
      </li>
      <li>
        commit the project:
        <GitHubCommand template={'git commit -m "add the full project"'} />
        if git asks who you are, set your name and github email, then run the commit command again:
        <GitHubCommand template={'git config user.name "Your Name"'} />
        <GitHubCommand template={'git config user.email "your-github-email@example.com"'} />
        you can use your github no-reply email from <a href="https://github.com/settings/emails">github's email settings</a>.
      </li>
      <li>
        upload the commit:
        <GitHubCommand template="git push -u origin HEAD" />
        if git rejects the push because github has newer commits, stop and check with your reviewer rather than using force push.
        {#if repository}
          refresh <a href={'https://github.com/' + repository.github}>your repository on github</a> and check that the full project is there.
        {:else}
          refresh your repository on github and check that the full project is there.
        {/if}
      </li>
    </ol>
  </details>

  <details class="platform" id="linux" bind:open={expanded.linux}>
    <summary><h2 id="linux-title">linux</h2></summary>
    <p>open a terminal and choose your distribution below to install git and the github cli. run each command in order and wait for it to finish.</p>

    <details class="distro">
      <summary>ubuntu, debian, linux mint, and pop!_os</summary>
      {#if !local}
        <p>install git:</p>
        <GitHubCommand template="sudo apt update && sudo apt install git" />
      {/if}
      <p>add github's package repository and install the github cli:</p>
      <GitHubCommand template={aptGitHubSetup} />
    </details>

    <details class="distro">
      <summary>fedora</summary>
      <GitHubCommand template={local ? 'sudo dnf install gh' : 'sudo dnf install git gh'} />
    </details>

    <details class="distro">
      <summary>arch linux and endeavouros</summary>
      <GitHubCommand template={local ? 'sudo pacman -Syu github-cli' : 'sudo pacman -Syu git github-cli'} />
    </details>

    <details class="distro">
      <summary>opensuse tumbleweed</summary>
      <GitHubCommand template={local ? 'sudo zypper install gh' : 'sudo zypper install git gh'} />
    </details>
    <ol class="linux-steps">
      <li>
        next, log in to github:
        <GitHubCommand template="gh auth login" />
        choose <strong>GitHub.com</strong>, <strong>HTTPS</strong>, and <strong>Login with a web browser</strong>.
        follow the instructions to finish logging in, then run:
        <GitHubCommand template="gh auth setup-git" />
      </li>
      <li>
        in your file manager, find your actual project folder and choose <strong>Open in Terminal</strong> if that option is available.
        otherwise, in terminal type <code>cd</code> followed by a space and the full path to your project folder, surrounded by double quotes,
        then press <kbd>Enter</kbd>. for godot, choose the folder containing <code>project.godot</code>.
      </li>
      <li>
        turn this folder into a git repository:
        <GitHubCommand template="git init -b main" />
        this guide is for a folder without existing git history. if git says it reinitialized an existing repository, stop here and ask in the help channel.
      </li>
      <li>
        connect it to your github repository:
        {#if repository}
          <GitHubCommand template={'git remote add origin {url}'} {repository} />
        {:else}
          <p>enter your github repository above to get your connection command.</p>
        {/if}
      </li>
      <li>
        check the branch name on github. the commands below use <code>main</code>; if your default branch has another name,
        replace <code>main</code> in both commands with that name.
        <GitHubCommand template="git branch -M main" />
        download that branch's history:
        <GitHubCommand template="git fetch origin main" />
        if the github repository is completely empty, there is no branch to fetch yet. skip the next step and continue to staging your files.
        for any other fetch error, fix it before continuing.
      </li>
      <li>
        use the downloaded history as the starting point, while keeping your local project files exactly as they are:
        <GitHubCommand template="git reset --mixed FETCH_HEAD" />
        use <code>--mixed</code> exactly as shown. this command does not download or replace your project files.
        files present on github but missing from this folder will appear as deletions in your next commit.
        put any README or license you want to keep into this folder before continuing.
      </li>
      <li>
        open the project in this folder in your editor and check that it works. then, back in terminal, stage the files and check the list:
        <GitHubCommand template="git add --all" />
        <GitHubCommand template="git status" />
        check that your scenes, scripts, art, and audio are included. deleted files are included too, so the commit reflects this folder's current contents.
        ignored files won't be uploaded; if something you need is missing, check <code>.gitignore</code> before continuing.
      </li>
      <li>
        commit the project:
        <GitHubCommand template={'git commit -m "add the full project"'} />
        if git asks who you are, set your name and github email, then run the commit command again:
        <GitHubCommand template={'git config user.name "Your Name"'} />
        <GitHubCommand template={'git config user.email "your-github-email@example.com"'} />
        you can use your github no-reply email from <a href="https://github.com/settings/emails">github's email settings</a>.
      </li>
      <li>
        upload the commit:
        <GitHubCommand template="git push -u origin HEAD" />
        if git rejects the push because github has newer commits, stop and check with your reviewer rather than using force push.
        {#if repository}
          refresh <a href={'https://github.com/' + repository.github}>your repository on github</a> and check that the full project is there.
        {:else}
          refresh your repository on github and check that the full project is there.
        {/if}
      </li>
    </ol>
  </details>
</main>

<Footer />

<style>
  :global(#boot-vignette) { display: none; }
  .guide {
    --guide-rose: #8b4845;
    --guide-blue: #405b90;
    --guide-green: #41653b;
    position: relative;
    z-index: 2;
    max-width: var(--col);
    margin: 0 auto;
    padding: 3rem var(--col-pad) 6rem;
    color: var(--ink);
    font-size: var(--t-small);
    line-height: 1.65;
  }
  .guide ::selection { background: #f2d4d0; color: #504b49; }
  a { color: var(--guide-rose); text-underline-offset: 0.25em; }
  a:hover { text-decoration-thickness: 2px; }
  .back { font-size: 0.9em; }
  h1 { margin: 2rem 0 2.5rem; font-size: calc(64px * var(--scale)); font-weight: normal; line-height: 1.2; }
  h2 { margin: 0 0 1rem; font-size: var(--t-card); font-weight: normal; color: var(--section-ink); }
  .repository { margin-bottom: 2rem; }
  label { display: block; margin-bottom: 0.65rem; }
  .repository-input { display: flex; flex-wrap: wrap; gap: 0.75rem; }
  input, button {
    box-sizing: border-box;
    padding: 0.65rem 0.9rem;
    border: 1px solid #aa8580;
    border-radius: 4px;
    color: var(--ink);
    background: #fffdfb;
    font: inherit;
  }
  input { flex: 1 1 12rem; min-width: 0; caret-color: var(--guide-rose); }
  abbr[title] {
    text-decoration: underline dotted;
    text-underline-offset: 0.2em;
    cursor: help;
  }
  input::placeholder { color: #7b706c; opacity: 1; }
  button { background: #f2d4d0; color: #683d39; }
  button:hover { background: #eabfba; }
  :is(a, input, button):focus-visible { outline: 2px solid var(--guide-rose); outline-offset: 4px; }
  .error { margin: 0.5rem 0 0; color: var(--guide-rose); }
  nav { display: flex; flex-wrap: wrap; gap: 0.65rem; margin-bottom: 3rem; }
  nav a { padding: 0.45rem 1rem; text-decoration: none; border-radius: 4px; }
  nav a[href="#windows"] { background: #f6dfdc; color: var(--guide-rose); }
  nav a[href="#macos"] { background: #e2e8f5; color: var(--guide-blue); }
  nav a[href="#linux"] { background: #e4eedf; color: var(--guide-green); }
  nav a:hover { text-decoration: underline; }
  p { margin: 0 0 1.5rem; }
  kbd { font: inherit; font-size: 0.85em; padding: 0.1em 0.3em; border: 1px solid #d6ccc6; border-radius: 3px; background: #f1eee8; }
  li > code { font-family: ui-monospace, monospace; font-size: 0.8em; overflow-wrap: anywhere; }
  strong { color: var(--section-ink); }
  ol { padding-left: 1.75rem; margin: 0 0 1rem; }
  li { padding-left: 0.4rem; margin-bottom: 1.25rem; }
  li::marker { color: var(--section-ink); }
  section, .platform { padding: 2rem 0; border-top: 1px solid var(--section-line); scroll-margin-top: 1rem; }
  .platform > summary { cursor: pointer; color: var(--section-ink); }
  .platform > summary h2 { display: inline; margin: 0; }
  .platform[open] > summary { margin-bottom: 1.5rem; }
  .platform > summary:hover h2 { text-decoration: underline; text-underline-offset: 0.2em; }
  .platform > summary:focus-visible { outline: 2px solid var(--section-ink); outline-offset: 4px; }
  #about-git { --section-ink: var(--ink); border-top: 0; padding-top: 0; }
  #windows { --section-ink: var(--guide-rose); --section-line: #e5c2bc; }
  #macos { --section-ink: var(--guide-blue); --section-line: #c6d2eb; }
  .linux-steps { margin-top: 2rem; }
  .distro { padding: 1rem 0; border-bottom: 1px solid #cbdcc3; }
  .distro summary { color: var(--guide-green); cursor: pointer; }
  .distro summary:focus-visible { outline: 2px solid var(--guide-green); outline-offset: 4px; }
  .distro[open] summary { margin-bottom: 1rem; }
  .distro p { margin: 1rem 0 0.5rem; }
  #linux { --section-ink: var(--guide-green); --section-line: #cbdcc3; }
  @media (max-width: 480px) {
    .guide { padding-top: 1.75rem; }
    h1 { font-size: 3rem; }
    .repository-input { flex-direction: column; }
    input { flex-basis: auto; width: 100%; }
    nav a { flex: 1; padding-inline: 0.65rem; text-align: center; }
  }
  img {
    display: block;
    max-width: 100%;
    height: auto;
    margin: 1.5rem 0;
  }
</style>
