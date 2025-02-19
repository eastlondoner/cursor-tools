Hi @overdrive-dev,

To use Gemini Pro with `cursor-tools`, you need to configure the `gemini.model` setting in your `cursor-tools.config.json` file. You can find this file in either your project's root directory or in your user home directory (`~/.cursor-tools/config.json`).

Here's how to set it:

1. **Locate or Create the Config File:**
   * Check your project's root directory for `cursor-tools.config.json`
   * If it's not there, check your home directory: `~/.cursor-tools/config.json`
   * If it doesn't exist in either location, create `~/.cursor-tools/config.json`

2. **Edit the `gemini` Section:**
   * Open the `cursor-tools.config.json` file in a text editor
   * Find the `gemini` section (or add it if it's missing). It should look like this:

   ```json
   {
     "gemini": {
       "model": "gemini-2.0-pro-exp-02-05",
       "maxTokens": 10000
     }
     // ... other configurations ...
   }
   ```

   * Change the `"model"` value to the Gemini Pro model you want to use. For example, if you want to use `gemini-pro`, you should not use it with very large repositories (above 800K tokens). The `gemini-2.0-pro-exp-02-05` model is recommended for large repositories up to 2M tokens.
   * So, to use `gemini-2.0-pro-exp-02-05`, make sure the section looks like the example above.

3. **Save the File:** Save the changes you made to `cursor-tools.config.json`

4. **Ensure API Key:** Make sure you have your `GEMINI_API_KEY` set in your `.cursor-tools.env` file (either in your project root or in `~/.cursor-tools/`)

After these steps, `cursor-tools` will use the specified Gemini Pro model for commands like `cursor-tools repo`. You don't need to specify the model on the command line unless you want to *temporarily* override your configured default. For example, `cursor-tools repo "explain this function" --model="gemini-pro"` would use `gemini-pro` for just that single command.

Let me know if you have any other questions! 