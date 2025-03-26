# Model Lookup

We use providers model listing endpoints where available to check the provided/configured model name.

Getting model names exactly right is a pain and providers are often changing the names. So if the model name does not match we look for possible matches and in some cases we automatically switch


## These should succeed by automatically switching to an actual model

we should be logging what is happening as well

Automatic addition of missing provider
```
pnpm dev ask --provider modelbox --model gemini-2.0-flash "what is today's date"
```

Automatic Removal of -exp suffix
```
pnpm dev ask --provider gemini --model gemini-2.0-flash-exp "what is today's date"
```

```
pnpm dev ask --provider gemini --model gemini-2.0-flash-exp-21-05 "what is today's date"
```

Automatic detection of exact substring match
```
pnpm dev doc "what does this do" --debug --provider=openrouter --model=gemini-2.5-pro-exp
```