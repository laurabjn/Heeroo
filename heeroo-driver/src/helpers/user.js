import { check_user_email_url } from "../common/key";


export const checkUserEmail = (email) => {
    const params = {
        email,
        type:"driver"
    }
    return fetch(check_user_email_url, {
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json'
        },
        method: 'post',
        body: JSON.stringify(params)
    }).then(response => response.json())
    .catch(error => {
        console.log("error", error)
        return false;
    });
}