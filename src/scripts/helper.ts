// matches links of the form http(s)://...
// and markdown style links of the form [text](http(s)://...)
const URL_REGEX = /\[[^\[]+]\(https?:\/\/[^\(]+\)|https?:\/\/[^\ ]+/g;

/**
 * shortens the string when it's longer than the limit and if it does
 * adds '…' at the end to show that it was truncated.
 * 
 * @param text - the text to shorten
 * @param maxLength - the point at which the text will be truncated
 */
export const shortenString = (text: string, maxLength: number) => {
    if (text.length <= maxLength)
        return text;

    // checks if a link would be broken by truncating the text and 
    // truncates it before the start of the link
    let result;
    while ((result = URL_REGEX.exec(text)) !== null) {
        // skip checking links that start after the maximum length
        if (result.index >= maxLength)
            break;
        else if (result.index + result[0].length >= maxLength)
            return `${text.slice(0, result.index).trim()}…`;
    }

    return `${text.slice(0, maxLength-1).trim()}…`;
} 
